import { currentUser } from '@clerk/nextjs/server';
import { ApplyLeaveView } from '@/features/leave/components/apply-leave-view';

export default async function ApplyLeavePage() {
  const user = await currentUser();
  const currentEmployeeId = (user?.unsafeMetadata?.employeeId as string) || 'EMP001';

  return <ApplyLeaveView employeeId={currentEmployeeId} />;
}
