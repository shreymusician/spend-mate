import { useState } from 'react';
import { SummaryView } from '@/components/finance/SummaryView';
import { TransactionList } from '@/components/finance/TransactionList';
import { PageTitle } from '@/components/ui/PageTitle';
import { Segmented } from '@/components/ui/Segmented';
import { currentMonth } from '@/lib/dates';

type View = 'list' | 'summary';

export function HistoryPage() {
  const [view, setView] = useState<View>('list');
  return (
    <div className="space-y-3">
      <PageTitle>History</PageTitle>
      <Segmented<View> label="History view" value={view} onChange={setView} options={[{ value: 'list', label: 'All entries' }, { value: 'summary', label: 'Summary' }]} />
      {view === 'list'
        ? <TransactionList basePath="/transactions" />
        : <SummaryView summaryPath="/analytics/summary" trendPath={`/analytics/trend?month=${currentMonth()}`} />}
    </div>
  );
}
