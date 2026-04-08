import Loading from '@/components/common/Loading';

export default function AuthBootScreen({ message = 'Restoring your secure session...' }) {
  return <Loading fullscreen title="Authenticating workspace" description={message} />;
}
