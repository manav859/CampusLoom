import ErrorState from '@/components/common/ErrorState';

export default function ApiErrorState({
  title = 'Unable to load data',
  message = 'Something went wrong while talking to the server.',
  onRetry,
}) {
  return <ErrorState title={title} message={message} actionLabel="Retry request" onAction={onRetry} />;
}
