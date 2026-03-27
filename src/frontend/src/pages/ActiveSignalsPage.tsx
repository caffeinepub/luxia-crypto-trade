import SignalPage from "./SignalPage";
export default function ActiveSignalsPage() {
  return (
    <SignalPage
      type="active"
      title="Active Signals"
      subtitle="All currently running trade signals"
      icon="🔴"
    />
  );
}
