import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BudgetMonth,
  CategoryDef,
  CategoryLimitsByMonth,
  DEFAULT_CATEGORIES,
  Expense,
  MonthData,
  SavingsGoal,
} from "@/types/finance";
import { DEFAULT_CATEGORY_ICON_KEY, inferIconKeyFromLabel } from "@/utils/categoryIcons";
import { getCurrentMonth, getPreviousMonth, normalizeCurrencyCode } from "@/utils/money";
import { hasSupabaseEnv, supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface StoredData {
  budgets: Record<string, BudgetMonth>;
  expenses: Expense[];
  customCategories: CategoryDef[];
  savingsGoals: SavingsGoal[];
  categoryLimits: CategoryLimitsByMonth;
}

interface BudgetMonthRow {
  id: string;
  month: string;
  salary_cents: number;
  currency: string | null;
  created_at: string;
  income_note: string | null;
}

interface ExpenseRow {
  id: string;
  budget_month_id: string;
  month: string;
  amount_cents: number;
  category: string;
  date: string;
  note: string | null;
  created_at: string;
}

interface CategoryRow {
  id: string;
  value: string;
  label: string;
  icon_key: string | null;
  is_custom: boolean;
  month: string | null;
  limit_cents: number | null;
}

interface GoalRow {
  id: string;
  name: string;
  target_cents: number;
  saved_cents: number;
  start_date: string;
  target_date: string;
  created_at: string;
}

const initialData: StoredData = {
  budgets: {},
  expenses: [],
  customCategories: [],
  savingsGoals: [],
  categoryLimits: {},
};

export function useSupabaseFinanceData() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<StoredData>(initialData);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setData(initialData);
      setIsLoading(false);
      return;
    }

    if (!user) {
      setData(initialData);
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      const [budgetsRes, expensesRes, categoriesRes, goalsRes] = await Promise.all([
        supabase.from("budget_months").select("*").eq("user_id", user.id),
        supabase.from("expenses").select("*").eq("user_id", user.id),
        supabase.from("categories").select("*").eq("user_id", user.id),
        supabase.from("goals").select("*").eq("user_id", user.id),
      ]);

      const budgetsMap: Record<string, BudgetMonth> = {};
      ((budgetsRes.data as BudgetMonthRow[] | null) ?? []).forEach((row) => {
        budgetsMap[row.month] = {
          id: row.id,
          month: row.month,
          salaryCents: row.salary_cents,
          currency: row.currency ?? "EUR",
          createdAt: row.created_at,
          incomeNote: row.income_note ?? undefined,
        };
      });

      const expenses: Expense[] = (((expensesRes.data as ExpenseRow[] | null) ?? []).map((row) => ({
        id: row.id,
        budgetMonthId: row.budget_month_id,
        month: row.month,
        amountCents: row.amount_cents,
        category: row.category,
        date: row.date,
        note: row.note ?? "",
        createdAt: row.created_at,
      })));

      const customCategories: CategoryDef[] = [];
      const categoryLimits: CategoryLimitsByMonth = {};
      const defaultCategoryValues = new Set(DEFAULT_CATEGORIES.map((c) => c.value));

      ((categoriesRes.data as CategoryRow[] | null) ?? []).forEach((row) => {
        const isStandaloneCustomRow =
          row.month == null &&
          row.limit_cents == null &&
          !defaultCategoryValues.has(row.value);

        if (row.is_custom || isStandaloneCustomRow) {
          customCategories.push({
            id: row.id,
            value: row.value,
            label: row.label,
            iconKey: row.icon_key ?? DEFAULT_CATEGORY_ICON_KEY,
            isCustom: true,
          });
        }

        if (row.month && typeof row.limit_cents === "number") {
          categoryLimits[row.month] = categoryLimits[row.month] ?? {};
          categoryLimits[row.month][row.value] = row.limit_cents;
        }
      });

      const savingsGoals: SavingsGoal[] = (((goalsRes.data as GoalRow[] | null) ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        targetCents: row.target_cents,
        savedCents: row.saved_cents,
        startDate: row.start_date,
        targetDate: row.target_date,
        createdAt: row.created_at,
      })));

      setData({
        budgets: budgetsMap,
        expenses,
        customCategories,
        savingsGoals,
        categoryLimits,
      });
      setIsLoading(false);
    };

    void load();
  }, [user]);

  const allCategories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...data.customCategories],
    [data.customCategories],
  );

  const getMonthData = useCallback(
    (month: string): MonthData => {
      const budget = data.budgets[month] || null;
      const expenses = data.expenses.filter((exp) => exp.month === month);
      return { budget, expenses };
    },
    [data],
  );

  const currentMonthData = getMonthData(currentMonth);

  const updateMonthlyIncome = useCallback(
    (month: string, salaryCents: number, incomeNote?: string, currencyOverride?: string) => {
      if (!user) return;

      let resolvedCurrency = "EUR";
      let rowId = "";

      setData((prev) => {
        const existingBudget = prev.budgets[month];
        resolvedCurrency = normalizeCurrencyCode(
          currencyOverride ?? existingBudget?.currency ?? "EUR",
        );
        rowId = existingBudget?.id ?? crypto.randomUUID();
        const updatedBudget: BudgetMonth = existingBudget
          ? { ...existingBudget, salaryCents, incomeNote, currency: resolvedCurrency }
          : {
              id: rowId,
              month,
              salaryCents,
              currency: resolvedCurrency,
              createdAt: new Date().toISOString(),
              incomeNote,
            };
        return { ...prev, budgets: { ...prev.budgets, [month]: updatedBudget } };
      });

      void supabase.from("budget_months").upsert({
        id: rowId,
        user_id: user.id,
        month,
        salary_cents: salaryCents,
        currency: resolvedCurrency,
        income_note: incomeNote ?? null,
      });

      void supabase.from("income_history").upsert({
        user_id: user.id,
        month,
        salary_cents: salaryCents,
        income_note: incomeNote ?? null,
      });
    },
    [user],
  );

  const setCurrency = useCallback(
    (currency: string) => {
      if (!user) return;
      const budget = data.budgets[currentMonth];
      updateMonthlyIncome(
        currentMonth,
        budget?.salaryCents ?? 0,
        budget?.incomeNote,
        currency,
      );
    },
    [user, currentMonth, data.budgets, updateMonthlyIncome],
  );

  const setSalary = useCallback(
    (salaryCents: number, incomeNote?: string) => {
      updateMonthlyIncome(currentMonth, salaryCents, incomeNote);
    },
    [currentMonth, updateMonthlyIncome],
  );

  const addExpense = useCallback(
    async (expense: Omit<Expense, "id" | "createdAt" | "budgetMonthId" | "month">) => {
      if (!user) {
        throw new Error("Not authenticated");
      }
      const budget = data.budgets[currentMonth];
      const budgetId = budget?.id ?? crypto.randomUUID();
      const newExpenseId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const { error: budgetError } = await supabase.from("budget_months").upsert(
        {
          id: budgetId,
          user_id: user.id,
          month: currentMonth,
          salary_cents: budget?.salaryCents ?? 0,
          currency: budget?.currency ?? "EUR",
          income_note: budget?.incomeNote ?? null,
        },
        { onConflict: "user_id,month" },
      );

      if (budgetError) {
        throw new Error(budgetError.message);
      }

      const { data: resolvedBudget, error: resolveBudgetError } = await supabase
        .from("budget_months")
        .select("id")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .maybeSingle();

      if (resolveBudgetError) {
        throw new Error(resolveBudgetError.message);
      }
      if (!resolvedBudget?.id) {
        throw new Error("Could not resolve budget month after save");
      }

      const resolvedBudgetId = resolvedBudget.id;

      const { error: expenseError } = await supabase.from("expenses").insert({
        id: newExpenseId,
        user_id: user.id,
        budget_month_id: resolvedBudgetId,
        month: currentMonth,
        amount_cents: expense.amountCents,
        category: expense.category,
        date: expense.date,
        note: expense.note?.trim() ? expense.note : null,
      });

      if (expenseError) {
        throw new Error(expenseError.message);
      }

      const newExpense: Expense = {
        ...expense,
        id: newExpenseId,
        budgetMonthId: resolvedBudgetId,
        month: currentMonth,
        createdAt,
      };

      setData((prev) => ({
        ...prev,
        budgets: prev.budgets[currentMonth]
          ? prev.budgets
          : {
              ...prev.budgets,
              [currentMonth]: {
                id: resolvedBudgetId,
                month: currentMonth,
                salaryCents: budget?.salaryCents ?? 0,
                currency: budget?.currency ?? "EUR",
                createdAt,
                incomeNote: budget?.incomeNote,
              },
            },
        expenses: [...prev.expenses, newExpense],
      }));

      return newExpense;
    },
    [currentMonth, data.budgets, user],
  );

  const updateExpense = useCallback(
    async (id: string, updates: Partial<Omit<Expense, "id" | "createdAt" | "budgetMonthId" | "month">>) => {
      if (!user) {
        throw new Error("Not authenticated");
      }

      const patch: Record<string, unknown> = {};
      if (updates.amountCents !== undefined) patch.amount_cents = updates.amountCents;
      if (updates.category !== undefined) patch.category = updates.category;
      if (updates.date !== undefined) {
        patch.date = updates.date;
        patch.month = updates.date.slice(0, 7);
      }
      if (updates.note !== undefined) patch.note = updates.note?.trim() ? updates.note : null;

      if (Object.keys(patch).length === 0) {
        return;
      }

      const { data: row, error } = await supabase
        .from("expenses")
        .update(patch)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, budget_month_id, month, amount_cents, category, date, note, created_at")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!row) {
        throw new Error("Expense not found or access denied");
      }

      setData((prev) => ({
        ...prev,
        expenses: prev.expenses.map((exp) => {
          if (exp.id !== id) return exp;
          return {
            ...exp,
            amountCents: row.amount_cents,
            category: row.category,
            date: row.date,
            month: row.month,
            note: row.note ?? "",
            budgetMonthId: row.budget_month_id,
            createdAt: row.created_at,
          };
        }),
      }));
    },
    [user],
  );

  const deleteExpense = useCallback(async (id: string) => {
    if (!user) {
      throw new Error("Not authenticated");
    }

    const { data: rows, error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      throw new Error(error.message);
    }
    if (!rows?.length) {
      throw new Error("Expense not found or access denied");
    }

    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((exp) => exp.id !== id),
    }));
  }, [user]);

  const addCustomCategory = useCallback(
    async (
      label: string,
      iconKeyInput?: string,
    ): Promise<{ success: true } | { success: false; error: string }> => {
      if (!user) return { success: false, error: "Not signed in" };
      const trimmedLabel = label.trim();
      const value = trimmedLabel
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
      if (!value) return { success: false, error: "Invalid category name" };

      const exists = [...DEFAULT_CATEGORIES, ...data.customCategories].some(
        (c) => c.value === value || c.label.trim().toLowerCase() === trimmedLabel.toLowerCase(),
      );
      if (exists) return { success: false, error: "A category with this name already exists" };

      const newCategory: CategoryDef = {
        id: crypto.randomUUID(),
        value,
        label: trimmedLabel,
        iconKey: iconKeyInput && iconKeyInput.length > 0 ? iconKeyInput : inferIconKeyFromLabel(trimmedLabel),
        isCustom: true,
      };

      const { error } = await supabase.from("categories").insert({
        id: newCategory.id,
        user_id: user.id,
        value: newCategory.value,
        label: newCategory.label,
        icon_key: newCategory.iconKey,
        is_custom: true,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setData((prev) => ({
        ...prev,
        customCategories: [...prev.customCategories, newCategory],
      }));
      return { success: true };
    },
    [data.customCategories, user],
  );

  const removeCustomCategory = useCallback(
    (value: string) => {
      if (!user) return;
      setData((prev) => ({
        ...prev,
        customCategories: prev.customCategories.filter((c) => c.value !== value),
      }));
      void supabase
        .from("categories")
        .delete()
        .eq("user_id", user.id)
        .eq("value", value)
        .is("month", null);
    },
    [user],
  );

  const deleteCategory = useCallback(
    (categoryValue: string): { success: true } | { success: false; error: string } => {
      const cat = allCategories.find((c) => c.value === categoryValue);
      if (!cat) return { success: false, error: "Category not found" };
      if (!cat.isCustom) return { success: false, error: "Default category can't be removed" };
      const inUse = data.expenses.some((exp) => exp.category === categoryValue);
      if (inUse) return { success: false, error: "Category is in use" };
      removeCustomCategory(categoryValue);
      return { success: true };
    },
    [allCategories, data.expenses, removeCustomCategory],
  );

  const categoryLimitsForMonth = data.categoryLimits[currentMonth] || {};

  const setCategoryLimit = useCallback(
    (categoryValue: string, limitCents: number) => {
      if (!user) return;
      setData((prev) => {
        const monthLimits = prev.categoryLimits[currentMonth] || {};
        const next = { ...monthLimits, [categoryValue]: limitCents };
        if (limitCents <= 0) {
          const { [categoryValue]: _removed, ...rest } = next;
          return {
            ...prev,
            categoryLimits: { ...prev.categoryLimits, [currentMonth]: rest },
          };
        }
        return {
          ...prev,
          categoryLimits: { ...prev.categoryLimits, [currentMonth]: next },
        };
      });

      if (limitCents <= 0) {
        void supabase
          .from("categories")
          .delete()
          .eq("user_id", user.id)
          .eq("value", categoryValue)
          .eq("month", currentMonth);
      } else {
        void supabase.from("categories").upsert({
          user_id: user.id,
          value: categoryValue,
          label: categoryValue,
          icon_key: DEFAULT_CATEGORY_ICON_KEY,
          is_custom: false,
          month: currentMonth,
          limit_cents: limitCents,
        });
      }
    },
    [currentMonth, user],
  );

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
    return {
      current,
      previous,
      differenceCents: current.salaryCents - previous.salaryCents,
    };
  }, [getCurrentMonthIncome, getPreviousMonthIncome]);

  const addSavingsGoal = useCallback(
    (goal: Omit<SavingsGoal, "id" | "createdAt">) => {
      if (!user) {
        throw new Error("Not authenticated");
      }
      const newGoal: SavingsGoal = {
        ...goal,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setData((prev) => ({
        ...prev,
        savingsGoals: [...prev.savingsGoals, newGoal],
      }));
      void supabase.from("goals").insert({
        id: newGoal.id,
        user_id: user.id,
        name: newGoal.name,
        target_cents: newGoal.targetCents,
        saved_cents: newGoal.savedCents,
        start_date: newGoal.startDate,
        target_date: newGoal.targetDate,
      });
      return newGoal;
    },
    [user],
  );

  const updateSavingsGoal = useCallback(
    (id: string, updates: Partial<Pick<SavingsGoal, "name" | "targetCents" | "savedCents" | "startDate" | "targetDate">>) => {
      setData((prev) => ({
        ...prev,
        savingsGoals: prev.savingsGoals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      }));
      void supabase
        .from("goals")
        .update({
          name: updates.name,
          target_cents: updates.targetCents,
          saved_cents: updates.savedCents,
          start_date: updates.startDate,
          target_date: updates.targetDate,
        })
        .eq("id", id);
    },
    [],
  );

  const deleteSavingsGoal = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.filter((g) => g.id !== id),
    }));
    void supabase.from("goals").delete().eq("id", id);
  }, []);

  const addContributionToGoal = useCallback(
    (goalId: string, amountCents: number) => {
      if (!user || amountCents <= 0) return;
      setData((prev) => ({
        ...prev,
        savingsGoals: prev.savingsGoals.map((g) =>
          g.id === goalId ? { ...g, savedCents: g.savedCents + amountCents } : g,
        ),
      }));
      void supabase.rpc("increment_goal_saved_cents", {
        p_goal_id: goalId,
        p_user_id: user.id,
        p_amount_cents: amountCents,
      });
      void supabase.from("goal_contributions").insert({
        user_id: user.id,
        goal_id: goalId,
        amount_cents: amountCents,
      });
    },
    [user],
  );

  return {
    isLoading,
    currentMonth,
    setCurrentMonth,
    getMonthData,
    budget: currentMonthData.budget,
    expenses: currentMonthData.expenses,
    totalSpentCents,
    remainingCents,
    setSalary,
    setCurrency,
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
