'use client';

import { useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat'
  });

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-ai-chat', handleOpen);
    return () => window.removeEventListener('open-ai-chat', handleOpen);
  }, []);

  return (
    <div className='fixed bottom-6 right-6 z-50 flex flex-col items-end'>
      {isOpen && (
        <Card className='w-80 h-[500px] mb-4 shadow-xl flex flex-col'>
          <CardHeader className='p-4 border-b flex flex-row items-center justify-between'>
            <CardTitle className='text-lg'>Ask AI</CardTitle>
            <Button
              variant='ghost'
              size='icon'
              className='h-6 w-6'
              onClick={() => setIsOpen(false)}
            >
              <Icons.close className='h-4 w-4' />
            </Button>
          </CardHeader>

          <ScrollArea className='flex-1 p-4'>
            <div className='flex flex-col gap-4'>
              {messages.length === 0 && (
                <div className='text-center text-muted-foreground text-sm mt-4'>
                  How can I help you today?
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'max-w-[80%] rounded-lg p-3 text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground self-end'
                      : 'bg-muted self-start'
                  )}
                >
                  {message.content}
                </div>
              ))}
              {isLoading && (
                <div className='bg-muted self-start max-w-[80%] rounded-lg p-3 text-sm flex items-center'>
                  <Icons.spinner className='h-4 w-4 animate-spin mr-2' />
                  Thinking...
                </div>
              )}
            </div>
          </ScrollArea>

          <CardFooter className='p-3 border-t'>
            <form onSubmit={handleSubmit} className='w-full flex gap-2'>
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder='Type a message...'
                className='flex-1'
                disabled={isLoading}
              />
              <Button type='submit' size='icon' disabled={isLoading || !input.trim()}>
                <Icons.send className='h-4 w-4' />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      {!isOpen && (
        <Button onClick={() => setIsOpen(true)} className='rounded-full h-14 w-14 shadow-lg'>
          <Icons.chat className='h-6 w-6' />
        </Button>
      )}
    </div>
  );
}
