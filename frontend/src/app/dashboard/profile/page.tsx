import { currentUser } from '@clerk/nextjs/server';
import { ProfileForm } from '@/features/profile/components/profile-form';

export default async function ProfilePage({
  searchParams
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const user = await currentUser();
  const currentEmployeeId = (user?.unsafeMetadata?.employeeId as string) || '';
  const role = (user?.unsafeMetadata?.role as string) || 'Employee';

  const targetId = params.id || currentEmployeeId;

  return (
    <div className='flex w-full flex-col p-4 md:p-8'>
      <ProfileForm targetId={targetId} currentRole={role} />
    </div>
  );
}
