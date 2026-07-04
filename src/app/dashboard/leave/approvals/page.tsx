import { currentUser } from '@clerk/nextjs/server';
import { LeaveApprovalBoard } from '@/features/leave/components/leave-approval-board';
import { redirect } from 'next/navigation';

export default async function LeaveApprovalsPage() {
  const user = await currentUser();
  const role = (user?.unsafeMetadata?.role as string) || 'Employee';

  if (role !== 'Admin' && role !== 'HR') {
    redirect('/dashboard/overview');
  }

  return <LeaveApprovalBoard />;
}
