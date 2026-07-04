import { searchParamsCache } from '@/lib/searchparams';
import UserListingPage from '@/features/users/components/user-listing';

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await searchParamsCache.parse(searchParams);
  return <UserListingPage />;
}
