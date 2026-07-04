'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getAttendance, postLeave, type AttendanceRecord } from '@/lib/api';
import { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

export function ApplyLeaveView({ employeeId }: { employeeId: string }) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [leaveType, setLeaveType] = useState('Paid');
  const [remarks, setRemarks] = useState('');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    async function load() {
      const records = await getAttendance(employeeId);
      setAttendance(records);
    }
    load();
  }, [employeeId]);

  const handleApply = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error('Please select a valid date range.');
      return;
    }

    await postLeave({
      employeeId,
      type: leaveType as 'Paid' | 'Sick' | 'Unpaid',
      startDate: dateRange.from.toISOString().split('T')[0],
      endDate: dateRange.to.toISOString().split('T')[0],
      remarks
    });

    toast.success('Leave applied successfully!');
    setDateRange(undefined);
    setRemarks('');
  };

  const presentDays = attendance.filter((a) => a.status === 'Present').map((a) => new Date(a.date));
  const absentDays = attendance.filter((a) => a.status === 'Absent').map((a) => new Date(a.date));
  const leaveDays = attendance.filter((a) => a.status === 'Leave').map((a) => new Date(a.date));

  return (
    <div className='p-4 md:p-8 flex flex-col items-center'>
      <Card className='w-full max-w-3xl'>
        <CardHeader>
          <CardTitle>Apply for Leave</CardTitle>
          <CardDescription>
            Select dates, choose leave type, and submit your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
            <div className='flex flex-col items-center justify-center border rounded-md p-4'>
              <Calendar
                mode='range'
                selected={dateRange}
                onSelect={setDateRange}
                className='rounded-md border'
                modifiers={{
                  present: presentDays,
                  absent: absentDays,
                  leave: leaveDays
                }}
                modifiersStyles={{
                  present: { borderBottom: '2px solid green' },
                  absent: { borderBottom: '2px solid red' },
                  leave: { borderBottom: '2px solid orange' }
                }}
              />
            </div>

            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label>Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select leave type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='Paid'>Paid</SelectItem>
                    <SelectItem value='Sick'>Sick</SelectItem>
                    <SelectItem value='Unpaid'>Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Remarks</Label>
                <Textarea
                  placeholder='Reason for leave'
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                />
              </div>

              <Button onClick={handleApply} className='w-full'>
                Submit Application
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
