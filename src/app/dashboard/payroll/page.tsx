import { currentUser } from '@clerk/nextjs/server';
import { PayrollView } from '@/features/payroll/components/payroll-view';

export default async function PayrollPage() {
  const user = await currentUser();
  const currentEmployeeId = (user?.unsafeMetadata?.employeeId as string) || 'EMP001';
  const role = (user?.unsafeMetadata?.role as string) || 'Employee';

  return <PayrollView employeeId={currentEmployeeId} role={role} />;
}
