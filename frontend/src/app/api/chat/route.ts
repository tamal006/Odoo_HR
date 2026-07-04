export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const latestMessage = messages[messages.length - 1]?.content || '';

  const responseText = `I am the Hermes Mock Agent. You just said: "${latestMessage}". I am currently in mock mode and will be replaced by the Odoo AI agent soon.`;
  const words = responseText.split(' ');

  const stream = new ReadableStream({
    async start(controller) {
      for (const word of words) {
        controller.enqueue(new TextEncoder().encode(word + ' '));
        // Add a small delay to simulate streaming
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}
