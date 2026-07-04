'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getPayroll,
  patchPayroll,
  getEmployees,
  type PayrollRecord,
  type Employee
} from '@/lib/api';

export function PayrollView({ employeeId, role }: { employeeId: string; role: string }) {
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState<Record<string, { base: number; deductions: number }>>(
    {}
  );

  const isAdmin = role === 'Admin' || role === 'HR';

  async function loadData() {
    setLoading(true);
    if (isAdmin) {
      const emps = await getEmployees();
      setEmployees(emps);
      let allRecords: PayrollRecord[] = [];
      for (const e of emps) {
        const p = await getPayroll(e.employeeId);
        if (p) allRecords.push(p);
      }
      setPayroll(allRecords);

      const newEditData: Record<string, { base: number; deductions: number }> = {};
      allRecords.forEach((p) => {
        newEditData[p.employeeId] = {
          base: p.basicSalary,
          deductions: p.pfDeduction + p.taxDeduction
        };
      });
      setEditData(newEditData);
    } else {
      const p = await getPayroll(employeeId);
      setPayroll(p ? [p] : []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, role]);

  const handleUpdate = async (empId: string) => {
    const data = editData[empId];
    if (data) {
      // Net salary calculation approximation
      const netSalary = data.base + 15000 + 5000 - data.deductions;
      await patchPayroll(empId, {
        basicSalary: data.base,
        taxDeduction: data.deductions,
        netSalary
      });
      await loadData();
    }
  };

  const getEmpName = (empId: string) =>
    employees.find((e) => e.employeeId === empId)?.name || empId;

  if (loading) return <div className='p-8'>Loading payroll...</div>;

  return (
    <div className='p-4 md:p-8 space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-3xl font-bold'>Payroll</h2>
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Manage Payroll</CardTitle>
            <CardDescription>Update base salaries and deductions for employees.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='border rounded-md'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payroll.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className='text-center h-24'>
                        No payroll data
                      </TableCell>
                    </TableRow>
                  ) : (
                    payroll.map((p) => {
                      const monthStr = new Date(p.lastUpdated).toLocaleString('default', {
                        month: 'long',
                        year: 'numeric'
                      });
                      return (
                        <TableRow key={p.employeeId}>
                          <TableCell className='font-medium'>{getEmpName(p.employeeId)}</TableCell>
                          <TableCell>{monthStr}</TableCell>
                          <TableCell>
                            <Input
                              type='number'
                              className='w-24'
                              value={editData[p.employeeId]?.base || 0}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  [p.employeeId]: {
                                    ...editData[p.employeeId],
                                    base: Number(e.target.value)
                                  }
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type='number'
                              className='w-24'
                              value={editData[p.employeeId]?.deductions || 0}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  [p.employeeId]: {
                                    ...editData[p.employeeId],
                                    deductions: Number(e.target.value)
                                  }
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>${p.netSalary.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant='default'>Paid</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size='sm' onClick={() => handleUpdate(p.employeeId)}>
                              Save
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {payroll.map((p) => {
            const monthStr = new Date(p.lastUpdated).toLocaleString('default', {
              month: 'long',
              year: 'numeric'
            });
            return (
              <Card key={p.employeeId}>
                <CardHeader>
                  <div className='flex justify-between items-center'>
                    <CardTitle>{monthStr}</CardTitle>
                    <Badge variant='default'>Paid</Badge>
                  </div>
                  <CardDescription>Pay slip details</CardDescription>
                </CardHeader>
                <CardContent className='space-y-2'>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Base Salary:</span>
                    <span className='font-medium'>${p.basicSalary.toLocaleString()}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Deductions:</span>
                    <span className='font-medium'>
                      ${(p.pfDeduction + p.taxDeduction).toLocaleString()}
                    </span>
                  </div>
                  <div className='pt-2 mt-2 border-t flex justify-between'>
                    <span className='font-semibold'>Net Pay:</span>
                    <span className='font-bold text-lg'>${p.netSalary.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {payroll.length === 0 && (
            <div className='col-span-full p-8 text-center text-muted-foreground border border-dashed rounded-lg'>
              No pay slips available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
