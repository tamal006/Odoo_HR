'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function OnboardingView() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('Employee');
  const [isLoading, setIsLoading] = useState(false);

  if (!isLoaded) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      await user.update({
        unsafeMetadata: {
          employeeId,
          role
        }
      });
      router.push('/dashboard/overview');
    } catch (error) {
      console.error('Error updating user metadata:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className='flex h-screen items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Welcome to HERMES</CardTitle>
          <CardDescription>Please complete your profile to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='employeeId'>Employee ID</Label>
              <Input
                id='employeeId'
                required
                placeholder='e.g. EMP001'
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='role'>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder='Select a role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='Employee'>Employee</SelectItem>
                  <SelectItem value='HR'>HR</SelectItem>
                  <SelectItem value='Admin'>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type='submit' className='w-full' disabled={isLoading || !employeeId}>
              {isLoading ? 'Saving...' : 'Complete Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
