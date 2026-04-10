const examTypeLabels = {
  midterm: 'Midterm',
  final: 'Final',
  unit_test: 'Unit Test',
  practical: 'Practical',
};

export default function ResultsTable({ results }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-left text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Subject</th>
              <th className="px-5 py-4">Marks</th>
              <th className="px-5 py-4">Max Marks</th>
              <th className="px-5 py-4">Percentage</th>
              <th className="px-5 py-4">Exam Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {results.map((result) => {
              const percentage = result.maxMarks > 0
                ? ((result.marks / result.maxMarks) * 100).toFixed(1)
                : '—';

              return (
                <tr key={result.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-5 py-4 font-semibold text-foreground">{result.subject}</td>
                  <td className="px-5 py-4">{result.marks}</td>
                  <td className="px-5 py-4">{result.maxMarks}</td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        percentage !== '—' && parseFloat(percentage) >= 40
                          ? 'font-semibold text-green-600'
                          : 'font-semibold text-destructive'
                      }
                    >
                      {percentage}%
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold">
                      {examTypeLabels[result.examType] || result.examType}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
