'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getLeaves, patchLeave, getEmployees, type LeaveRecord, type Employee } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

const columns = ['Pending', 'Approved', 'Rejected'];

export function LeaveApprovalBoard() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const emps = await getEmployees();
    setEmployees(emps);
    const allLeaves = await getLeaves();
    setLeaves(allLeaves);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: 'Pending' | 'Approved' | 'Rejected') => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    // Optimistic update
    setLeaves((prev) => prev.map((leave) => (leave.id === id ? { ...leave, status } : leave)));

    // Actual API update
    await patchLeave(id, status);
  };

  const getEmpName = (empId: string) =>
    employees.find((e) => e.employeeId === empId)?.name || empId;

  if (loading) return <div className='p-8'>Loading board...</div>;

  return (
    <div className='p-4 md:p-8 space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-3xl font-bold'>Leave Approvals</h2>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        {columns.map((column) => {
          const columnLeaves = leaves.filter((l) => l.status === column);
          return (
            <div
              key={column}
              className='bg-muted/50 p-4 rounded-xl flex flex-col gap-4 min-h-[500px]'
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column as any)}
            >
              <div className='flex items-center justify-between'>
                <h3 className='font-semibold text-lg'>{column}</h3>
                <Badge variant='secondary'>{columnLeaves.length}</Badge>
              </div>

              <div className='flex flex-col gap-3'>
                {columnLeaves.map((leave) => (
                  <Card
                    key={leave.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, leave.id)}
                    className='cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow'
                  >
                    <CardHeader className='p-4 pb-2'>
                      <div className='flex justify-between items-start'>
                        <CardTitle className='text-base'>{getEmpName(leave.employeeId)}</CardTitle>
                        <Badge
                          variant={
                            leave.type === 'Paid'
                              ? 'default'
                              : leave.type === 'Sick'
                                ? 'destructive'
                                : 'outline'
                          }
                        >
                          {leave.type}
                        </Badge>
                      </div>
                      <CardDescription className='text-xs'>
                        {leave.startDate} to {leave.endDate}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='p-4 pt-0'>
                      <p className='text-sm text-muted-foreground line-clamp-2'>
                        {leave.remarks || 'No remarks provided.'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
                {columnLeaves.length === 0 && (
                  <div className='text-center text-sm text-muted-foreground p-4 border border-dashed rounded-md'>
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
