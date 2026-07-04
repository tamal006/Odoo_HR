'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { useClerk, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function EmployeeDashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();

  const handleLogout = () => {
    signOut({ redirectUrl: '/' });
  };

  const recentActivity = [
    { id: 1, message: 'Your leave request was approved by HR.', time: '2 hours ago' },
    { id: 2, message: 'Payroll for the month of June has been processed.', time: '1 day ago' },
    { id: 3, message: 'You checked in at 09:05 AM today.', time: 'Today' }
  ];

  return (
    <div className='flex flex-1 flex-col space-y-4 p-4 md:p-8 pt-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-3xl font-bold tracking-tight'>
          Welcome, {user?.firstName || 'Employee'} 👋
        </h2>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Link href='/dashboard/profile'>
          <Card className='hover:bg-muted/50 transition-colors cursor-pointer'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Icons.user className='size-5' /> Profile
              </CardTitle>
              <CardDescription>View and edit your personal details</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href='/dashboard/attendance'>
          <Card className='hover:bg-muted/50 transition-colors cursor-pointer'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Icons.calendar className='size-5' /> Attendance
              </CardTitle>
              <CardDescription>View your daily and weekly attendance</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href='/dashboard/leave/apply'>
          <Card className='hover:bg-muted/50 transition-colors cursor-pointer'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Icons.page className='size-5' /> Leave Requests
              </CardTitle>
              <CardDescription>Apply for leave and check status</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Card className='hover:bg-muted/50 transition-colors cursor-pointer' onClick={handleLogout}>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-destructive'>
              <Icons.logout className='size-5' /> Logout
            </CardTitle>
            <CardDescription>Sign out of your account</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className='mt-8'>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity & Alerts</CardTitle>
            <CardDescription>Updates from the HR system and your AI assistant.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className='flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0'
                >
                  <div className='bg-primary/10 p-2 rounded-full'>
                    <Icons.notification className='size-4 text-primary' />
                  </div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>{activity.message}</p>
                    <p className='text-xs text-muted-foreground'>{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
