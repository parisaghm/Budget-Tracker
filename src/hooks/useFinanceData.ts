import { useState, useEffect, useCallback } from 'react';
import { BudgetMonth, Expense, MonthData, CategoryDef, DEFAULT_CATEGORIES, SavingsGoal, CategoryLimitsByMonth } from '@/types/finance';
import { getCurrentMonth, getPreviousMonth } from '@/utils/money';
import { DEFAULT_CATEGORY_ICON_KEY, migrateLegacyIconKey, inferIconKeyFromLabel } from '@/utils/categoryIcons';

const STORAGE_KEY = 'finance_app_data';

interface StoredData {
  budgets: Record<string, BudgetMonth>;
  expenses: Expense[];
  customCategories: CategoryDef[];
  savingsGoals: SavingsGoal[];
  /** Per-month, per-category limits in cents. month -> categoryValue -> limitCents */
  categoryLimits: CategoryLimitsByMonth;
}

function loadData(): StoredData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Non‑destructive migration for older stored data
      const rawCustom = Array.isArray(parsed.customCategories) ? parsed.customCategories : [];
      const customCategories: CategoryDef[] = rawCustom
        .map((c: any): CategoryDef | null => {
          const value: string | undefined =
            typeof c.value === 'string' && c.value
              ? c.value
              : typeof c.id === 'string' && c.id
                ? c.id
                : undefined;

          if (!value) return null;

          const label: string =
            typeof c.label === 'string' && c.label
              ? c.label
              : value;

          let iconKey =
            typeof c.iconKey === 'string' && c.iconKey
              ? c.iconKey
              : typeof c.icon === 'string' && c.icon
                ? migrateLegacyIconKey(c.icon)
                : DEFAULT_CATEGORY_ICON_KEY;

          // STEP 5 — refine legacy "tag" icon using label when possible
          if (iconKey === DEFAULT_CATEGORY_ICON_KEY) {
            iconKey = inferIconKeyFromLabel(label);
          }

          const isCustom: boolean =
            typeof c.isCustom === 'boolean'
              ? c.isCustom
              : true;

          return {
            id: typeof c.id === 'string' && c.id ? c.id : value,
            value,
            label,
            iconKey,
            isCustom,
          };
        })
        .filter((c: CategoryDef | null): c is CategoryDef => c !== null);

      const rawGoals = Array.isArray(parsed.savingsGoals) ? parsed.savingsGoals : [];
      const savingsGoals: SavingsGoal[] = rawGoals.map((g: any) => {
        const startDate =
          typeof g.startDate === 'string' && g.startDate
            ? g.startDate
            : (g.createdAt && g.createdAt.slice(0, 10)) || new Date().toISOString().slice(0, 10);
        const created = startDate ? new Date(startDate) : new Date();
        const targetDate =
          typeof g.targetDate === 'string' && g.targetDate
            ? g.targetDate
            : new Date(created.getFullYear(), created.getMonth() + 12, 1).toISOString().slice(0, 10);
        return {
          id: g.id,
          name: g.name,
          targetCents: typeof g.targetCents === 'number' ? g.targetCents : 0,
          savedCents: typeof g.savedCents === 'number' ? g.savedCents : 0,
          startDate,
          targetDate,
          createdAt: g.createdAt || new Date().toISOString(),
        };
      });

      return {
        budgets: parsed.budgets || {},
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        customCategories,
        savingsGoals,
        categoryLimits: parsed.categoryLimits && typeof parsed.categoryLimits === 'object' ? parsed.categoryLimits : {},
      };
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  return { budgets: {}, expenses: [], customCategories: [], savingsGoals: [], categoryLimits: {} };
}

function saveData(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

export function useFinanceData() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<StoredData>(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const allCategories = [...DEFAULT_CATEGORIES, ...data.customCategories];

  const getMonthData = useCallback((month: string): MonthData => {
    const budget = data.budgets[month] || null;
    const expenses = data.expenses.filter(exp => exp.month === month);
    return { budget, expenses };
  }, [data]);

  const currentMonthData = getMonthData(currentMonth);

  const getOrCreateBudget = useCallback((month: string): BudgetMonth => {
    const existing = data.budgets[month];
    if (existing) return existing;
    return {
      id: crypto.randomUUID(),
      month,
      salaryCents: 0,
      currency: 'EUR',
      createdAt: new Date().toISOString(),
    };
  }, [data.budgets]);

  /**
   * Update the income for a specific month, optionally attaching a note.
   * This keeps salary stored per month and is safe to call repeatedly.
   */
  const updateMonthlyIncome = useCallback((month: string, salaryCents: number, incomeNote?: string) => {
    setData(prev => {
      const existingBudget = prev.budgets[month];
      const baseBudget: BudgetMonth = existingBudget
        ? existingBudget
        : {
            id: crypto.randomUUID(),
            month,
            salaryCents: 0,
            currency: 'EUR',
            createdAt: new Date().toISOString(),
          };

      const updatedBudget: BudgetMonth = {
        ...baseBudget,
        salaryCents,
        incomeNote: incomeNote !== undefined ? incomeNote : baseBudget.incomeNote,
      };

      return {
        ...prev,
        budgets: { ...prev.budgets, [month]: updatedBudget },
      };
    });
  }, []);

  /**
   * Convenience wrapper to update the current month's salary and optional note.
   */
  const setSalary = useCallback((salaryCents: number, incomeNote?: string) => {
    updateMonthlyIncome(currentMonth, salaryCents, incomeNote);
  }, [currentMonth, updateMonthlyIncome]);

  const addExpense = useCallback((expense: Omit<Expense, 'id' | 'createdAt' | 'budgetMonthId' | 'month'>) => {
    const budget = getOrCreateBudget(currentMonth);
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      budgetMonthId: budget.id,
      month: currentMonth,
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({
      ...prev,
      budgets: { ...prev.budgets, [currentMonth]: prev.budgets[currentMonth] || budget },
      expenses: [...prev.expenses, newExpense],
    }));
    return newExpense;
  }, [currentMonth, getOrCreateBudget]);

  const updateExpense = useCallback((id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'budgetMonthId' | 'month'>>) => {
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.map(exp => exp.id === id ? { ...exp, ...updates } : exp),
    }));
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.filter(exp => exp.id !== id),
    }));
  }, []);

  const addCustomCategory = useCallback((label: string, iconKeyInput?: string) => {
    const trimmedLabel = label.trim();
    const value = trimmedLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!value) return;

    const allCategories = [...DEFAULT_CATEGORIES, ...data.customCategories];

    // Prevent duplicates by value or label (case‑insensitive)
    const lowerLabel = trimmedLabel.toLowerCase();
    const exists = allCategories.some(
      c =>
        c.value === value ||
        c.label.trim().toLowerCase() === lowerLabel,
    );
    if (exists) return;

    const iconKey = iconKeyInput && iconKeyInput.length > 0 ? iconKeyInput : inferIconKeyFromLabel(trimmedLabel);

    const newCategory: CategoryDef = {
      id: value,
      value,
      label: trimmedLabel,
      iconKey,
      isCustom: true,
    };

    setData(prev => ({
      ...prev,
      customCategories: [...prev.customCategories, newCategory],
    }));
  }, [data.customCategories]);

  const removeCustomCategory = useCallback((value: string) => {
    setData(prev => ({
      ...prev,
      customCategories: prev.customCategories.filter(c => c.value !== value),
    }));
  }, []);

  const deleteCategory = useCallback((categoryValue: string): { success: true } | { success: false; error: string } => {
    const cat = allCategories.find(c => c.value === categoryValue);
    if (!cat) return { success: false, error: 'Category not found' };
    if (!cat.isCustom) return { success: false, error: "Default category can't be removed" };
    const inUse = data.expenses.some(exp => exp.category === categoryValue);
    if (inUse) return { success: false, error: 'Category is in use' };
    removeCustomCategory(categoryValue);
    return { success: true };
  }, [allCategories, data.expenses, removeCustomCategory]);

  const categoryLimitsForMonth = data.categoryLimits[currentMonth] || {};

  const setCategoryLimit = useCallback((categoryValue: string, limitCents: number) => {
    setData(prev => {
      const monthLimits = prev.categoryLimits[currentMonth] || {};
      const next = { ...monthLimits, [categoryValue]: limitCents };
      if (limitCents <= 0) {
        const { [categoryValue]: _, ...rest } = next;
        return {
          ...prev,
          categoryLimits: {
            ...prev.categoryLimits,
            [currentMonth]: Object.keys(rest).length ? rest : {},
          },
        };
      }
      return {
        ...prev,
        categoryLimits: {
          ...prev.categoryLimits,
          [currentMonth]: next,
        },
      };
    });
  }, [currentMonth]);

  const totalSpentCents = currentMonthData.expenses.reduce((sum, exp) => sum + exp.amountCents, 0);
  const remainingCents = (currentMonthData.budget?.salaryCents || 0) - totalSpentCents;

  const getCurrentMonthIncome = useCallback(() => {
    const budget = data.budgets[currentMonth];
    return {
      month: currentMonth,
      salaryCents: budget?.salaryCents ?? 0,
      incomeNote: budget?.incomeNote,
    };
  }, [currentMonth, data.budgets]);

  const getPreviousMonthIncome = useCallback(() => {
    const previousMonth = getPreviousMonth(currentMonth);
    const budget = data.budgets[previousMonth];
    return {
      month: previousMonth,
      salaryCents: budget?.salaryCents ?? 0,
      incomeNote: budget?.incomeNote,
    };
  }, [currentMonth, data.budgets]);

  const getIncomeDifference = useCallback(() => {
    const current = getCurrentMonthIncome();
    const previous = getPreviousMonthIncome();
    const differenceCents = current.salaryCents - previous.salaryCents;
    return {
      current,
      previous,
      differenceCents,
    };
  }, [getCurrentMonthIncome, getPreviousMonthIncome]);

  const addSavingsGoal = useCallback((goal: Omit<SavingsGoal, 'id' | 'createdAt'>) => {
    const newGoal: SavingsGoal = {
      ...goal,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({
      ...prev,
      savingsGoals: [...prev.savingsGoals, newGoal],
    }));
    return newGoal;
  }, []);

  const updateSavingsGoal = useCallback((id: string, updates: Partial<Pick<SavingsGoal, 'name' | 'targetCents' | 'savedCents' | 'startDate' | 'targetDate'>>) => {
    setData(prev => ({
      ...prev,
      savingsGoals: prev.savingsGoals.map(g => g.id === id ? { ...g, ...updates } : g),
    }));
  }, []);

  const deleteSavingsGoal = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      savingsGoals: prev.savingsGoals.filter(g => g.id !== id),
    }));
  }, []);

  const addContributionToGoal = useCallback((goalId: string, amountCents: number) => {
    if (amountCents <= 0) return;
    setData(prev => ({
      ...prev,
      savingsGoals: prev.savingsGoals.map(g =>
        g.id === goalId ? { ...g, savedCents: g.savedCents + amountCents } : g
      ),
    }));
  }, []);

  return {
    currentMonth,
    setCurrentMonth,
    getMonthData,
    budget: currentMonthData.budget,
    expenses: currentMonthData.expenses,
    totalSpentCents,
    remainingCents,
    setSalary,
    updateMonthlyIncome,
    getCurrentMonthIncome,
    getPreviousMonthIncome,
    getIncomeDifference,
    addExpense,
    updateExpense,
    deleteExpense,
    allCategories,
    customCategories: data.customCategories,
    addCustomCategory,
    removeCustomCategory,
    deleteCategory,
    categoryLimitsForMonth,
    setCategoryLimit,
    savingsGoals: data.savingsGoals,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    addContributionToGoal,
  };
}
