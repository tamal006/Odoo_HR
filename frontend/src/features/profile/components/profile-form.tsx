'use client';

import { useEffect, useState } from 'react';
import { getEmployee, type Employee } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function ProfileForm({ targetId, currentRole }: { targetId: string; currentRole: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = currentRole === 'Admin' || currentRole === 'HR';

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await getEmployee(targetId);
      setEmployee(data);
      setLoading(false);
    }
    loadData();
  }, [targetId]);

  if (loading) return <div>Loading profile...</div>;
  if (!employee) return <div>Profile not found.</div>;

  return (
    <div className='space-y-6 max-w-2xl mx-auto w-full'>
      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>View and manage employee profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='space-y-4' onSubmit={(e) => e.preventDefault()}>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label>Employee ID</Label>
                <Input value={employee.employeeId} readOnly disabled />
              </div>
              <div className='space-y-2'>
                <Label>Name</Label>
                <Input value={employee.name} readOnly={!isAdmin} disabled={!isAdmin} />
              </div>
              <div className='space-y-2'>
                <Label>Email</Label>
                <Input value={employee.email} readOnly={!isAdmin} disabled={!isAdmin} />
              </div>
              <div className='space-y-2'>
                <Label>Role</Label>
                <Input value={employee.role} readOnly={!isAdmin} disabled={!isAdmin} />
              </div>
              <div className='space-y-2'>
                <Label>Department</Label>
                <Input value={employee.department} readOnly={!isAdmin} disabled={!isAdmin} />
              </div>
              <div className='space-y-2'>
                <Label>Designation</Label>
                <Input value={employee.designation} readOnly={!isAdmin} disabled={!isAdmin} />
              </div>

              {/* Employee editable fields */}
              <div className='space-y-2'>
                <Label>Phone</Label>
                <Input defaultValue={employee.phone} />
              </div>
              <div className='space-y-2'>
                <Label>Address</Label>
                <Input defaultValue={employee.address} />
              </div>
            </div>

            <div className='flex justify-end pt-4'>
              <Button type='submit'>Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
