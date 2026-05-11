import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useSupabaseFinanceData } from '@/hooks/useSupabaseFinanceData';
import { formatMoney, formatMonth, formatDate } from '@/utils/money';
import { getCategoryLabel } from '@/types/finance';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function Report() {
  const navigate = useNavigate();
  const { monthKey } = useParams<{ monthKey: string }>();
  const reportRef = useRef<HTMLDivElement | null>(null);

  const {
    currentMonth,
    setCurrentMonth,
    getMonthData,
    allCategories,
    savingsGoals,
  } = useSupabaseFinanceData();

  useEffect(() => {
    if (monthKey && monthKey !== currentMonth) {
      setCurrentMonth(monthKey);
    }
  }, [monthKey, currentMonth, setCurrentMonth]);

  const effectiveMonthKey = monthKey || currentMonth;
  const monthData = getMonthData(effectiveMonthKey);

  const salaryCents = monthData.budget?.salaryCents ?? 0;
  const currency = monthData.budget?.currency ?? 'EUR';

  const totalSpentCents = useMemo(
    () => monthData.expenses.reduce((sum, exp) => sum + exp.amountCents, 0),
    [monthData.expenses],
  );

  const remainingCents = salaryCents - totalSpentCents;

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    monthData.expenses.forEach((exp) => {
      map.set(exp.category, (map.get(exp.category) || 0) + exp.amountCents);
    });
    return Array.from(map.entries())
      .map(([category, amountCents]) => ({
        category,
        label: getCategoryLabel(
          category,
          allCategories.filter((c) => c.isCustom),
        ),
        amountCents,
      }))
      .sort((a, b) => b.amountCents - a.amountCents);
  }, [monthData.expenses, allCategories]);

  const recentExpenses = useMemo(
    () =>
      [...monthData.expenses]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10),
    [monthData.expenses],
  );

  const hasSavingsGoals = savingsGoals.length > 0;
  const totalSavedCents = savingsGoals.reduce((sum, goal) => sum + goal.savedCents, 0);
  const totalTargetCents = savingsGoals.reduce((sum, goal) => sum + goal.targetCents, 0);

  const handleExportPdf = async () => {
    if (!reportRef.current) return;

    const element = reportRef.current;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;
    const contentHeight = pageHeight - 2 * margin;

    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= contentHeight) {
      pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = margin;
      let page = 1;
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;
      while (heightLeft > 0) {
        position = -contentHeight * page + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
        page += 1;
      }
    }

    pdf.save(`monthly-report-${effectiveMonthKey}.pdf`);
  };

  const monthLabel = formatMonth(effectiveMonthKey);

  return (
    <>
      <Helmet>
        <title>Monthly Report - {monthLabel}</title>
      </Helmet>

      <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-8 px-4 print:bg-white print:text-black">
        {/* Top controls (hidden in print) */}
        <div className="w-full max-w-4xl mb-4 flex items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-secondary"
          >
            Back to dashboard
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="btn-primary"
          >
            Download PDF
          </button>
        </div>
        <p className="w-full max-w-4xl mb-4 text-xs text-muted-foreground no-print text-right">
          A PDF file of this report will be generated and downloaded.
        </p>

        {/* Printable / exportable report */}
        <div
          ref={reportRef}
          className="w-full max-w-4xl bg-card text-card-foreground rounded-2xl border border-border shadow-md p-8 print:shadow-none print:border-0 print:rounded-none print:w-full print:max-w-none print:p-0 print:bg-white report-page"
        >
          <header className="pb-6 mb-6 border-b border-border flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Monthly Finance Report</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {monthLabel}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Generated on {new Date().toLocaleDateString()}</p>
              {monthData.budget && (
                <p className="mt-1">Currency: {currency}</p>
              )}
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="border border-border rounded-xl p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Monthly salary
              </h2>
              <p className="text-lg font-semibold money-display">
                {formatMoney(salaryCents, currency)}
              </p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Total spent
              </h2>
              <p className="text-lg font-semibold money-display">
                {formatMoney(totalSpentCents, currency)}
              </p>
            </div>
            <div className="border border-border rounded-xl p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Remaining amount
              </h2>
              <p className={`text-lg font-semibold money-display ${remainingCents < 0 ? 'text-destructive' : ''}`}>
                {formatMoney(remainingCents, currency)}
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Spending by category
            </h2>
            {expensesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No expenses recorded for this month.
              </p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-muted-foreground">Category</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {expensesByCategory.map((item) => {
                    const share = totalSpentCents > 0
                      ? Math.round((item.amountCents / totalSpentCents) * 100)
                      : 0;
                    return (
                      <tr key={item.category} className="border-b border-border/60 last:border-b-0">
                        <td className="py-1.5 pr-3">{item.label}</td>
                        <td className="py-1.5 text-right money-display">
                          {formatMoney(item.amountCents, currency)}
                        </td>
                        <td className="py-1.5 text-right text-xs text-muted-foreground">
                          {share}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Recent expenses
            </h2>
            {recentExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No expenses recorded for this month.
              </p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-muted-foreground">Date</th>
                    <th className="py-2 text-left font-medium text-muted-foreground">Category</th>
                    <th className="py-2 text-left font-medium text-muted-foreground">Note</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.map((expense) => {
                    const categoryLabel = getCategoryLabel(
                      expense.category,
                      allCategories.filter((c) => c.isCustom),
                    );
                    return (
                      <tr key={expense.id} className="border-b border-border/60 last:border-b-0 align-top">
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {formatDate(expense.date)}
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {categoryLabel}
                        </td>
                        <td className="py-1.5 pr-3 text-muted-foreground">
                          {expense.note || '\u2014'}
                        </td>
                        <td className="py-1.5 text-right money-display whitespace-nowrap">
                          {formatMoney(expense.amountCents, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {hasSavingsGoals && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Savings goals summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="border border-border rounded-xl p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Active goals
                  </h3>
                  <p className="text-lg font-semibold">
                    {savingsGoals.length}
                  </p>
                </div>
                <div className="border border-border rounded-xl p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Total saved
                  </h3>
                  <p className="text-lg font-semibold money-display">
                    {formatMoney(totalSavedCents, currency)}
                  </p>
                </div>
                <div className="border border-border rounded-xl p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Total targets
                  </h3>
                  <p className="text-lg font-semibold money-display">
                    {formatMoney(totalTargetCents, currency)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Savings goals are tracked across all months and shown here for quick reference.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

