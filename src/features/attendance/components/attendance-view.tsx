'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  getAttendance,
  postCheckIn,
  getEmployees,
  type AttendanceRecord,
  type Employee
} from '@/lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function AttendanceView({ employeeId, role }: { employeeId: string; role: string }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = role === 'Admin' || role === 'HR';

  const loadData = async () => {
    setLoading(true);
    if (isAdmin) {
      const emps = await getEmployees();
      setEmployees(emps);
      let allRecords: AttendanceRecord[] = [];
      for (const e of emps) {
        const r = await getAttendance(e.employeeId);
        allRecords = [...allRecords, ...r];
      }
      setRecords(allRecords);
    } else {
      const myRecords = await getAttendance(employeeId);
      setRecords(myRecords);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, role]);

  const handleCheckIn = async () => {
    await postCheckIn(employeeId);
    await loadData();
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'Present':
        return <Badge variant='default'>{status}</Badge>;
      case 'Absent':
        return <Badge variant='destructive'>{status}</Badge>;
      case 'Half-day':
        return <Badge variant='secondary'>{status}</Badge>;
      case 'Leave':
        return <Badge variant='outline'>{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getEmpName = (empId: string) =>
    employees.find((e) => e.employeeId === empId)?.name || empId;

  return (
    <div className='p-4 md:p-8 space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-3xl font-bold'>Attendance</h2>
        <Button onClick={handleCheckIn}>Check In / Check Out</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='daily'>
            <TabsList className='mb-4'>
              <TabsTrigger value='daily'>Daily View</TabsTrigger>
              <TabsTrigger value='weekly'>Weekly View</TabsTrigger>
            </TabsList>
            <TabsContent value='daily'>
              <div className='border rounded-md'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && <TableHead>Employee</TableHead>}
                      <TableHead>Date</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className='text-center h-24'>
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className='text-center h-24'>
                          No records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((record) => (
                        <TableRow key={record.id}>
                          {isAdmin && <TableCell>{getEmpName(record.employeeId)}</TableCell>}
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{record.checkIn || '-'}</TableCell>
                          <TableCell>{record.checkOut || '-'}</TableCell>
                          <TableCell>
                            <StatusBadge status={record.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value='weekly'>
              <div className='text-muted-foreground p-8 text-center border rounded-md'>
                Weekly view grouping appears here.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
