const fs = require('fs');

let content = fs.readFileSync('src/app/api/avatar/chat/route.ts', 'utf-8');

// 1. Add Stripe import and Prisma import (Prisma is already imported)
if (!content.includes('createStripePackageLink')) {
  content = content.replace(
    "import { formatConversationHistory } from '@/lib/avatar/conversationHistory';",
    "import { formatConversationHistory } from '@/lib/avatar/conversationHistory';\nimport { createStripePackageLink } from '@/lib/stripe/client';"
  );
}

// 2. Update System Prompt
const oldPromptEnd = `Respond naturally as Judy Pierre. Do NOT use markdown formatting — speak plainly as if talking out loud.\`;`;
const newPromptEnd = `Respond naturally as Judy Pierre. Do NOT use markdown formatting — speak plainly as if talking out loud.

You also have the ability to create and sell custom travel experience packages to users (e.g. pre-paid entry to events, excursions, cruises, hikes, tours, tastings). When a user asks to plan or book something, research/curate LGBTQ+-friendly options, estimate the wholesale vendor cost based on typical market rates, and invoke the \`create_stripe_package\` tool. Then, give the user the resulting payment link.\`;`;
content = content.replace(oldPromptEnd, newPromptEnd);

// 3. Define the tool
const toolDef = `
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'create_stripe_package',
            description: 'Creates a custom travel experience package and generates a Stripe payment link to sell it to the user. You must estimate the wholesale vendor cost, and this system will automatically mark it up by 27-39% for the retail price.',
            parameters: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING', description: 'Short, catchy title of the package' },
                description: { type: 'STRING', description: 'Detailed description of the package and what it includes' },
                vendorCostUSD: { type: 'NUMBER', description: 'Your estimated wholesale/vendor cost in USD (e.g., 50.0)' },
              },
              required: ['title', 'description', 'vendorCostUSD'],
            },
          },
        ],
      },
    ];
`;

content = content.replace(
  "const wantsStream = request.headers.get('accept')?.includes('text/event-stream');",
  toolDef + "\n    const wantsStream = request.headers.get('accept')?.includes('text/event-stream');"
);

// 4. Update the Streaming loop to support function calls
// First, find the `const chunks = await genAI.models.generateContentStream` block.
const streamStart = /const chunks = await genAI\.models\.generateContentStream\(\{[\s\S]*?for await \(const chunk of chunks\) \{/g;

const newStreamStart = `
            let historyContents = [{ role: 'user', parts: [{ text: geminiPrompt }] }];
            let chunks = await genAI.models.generateContentStream({
              model: configuredGeminiTextModel(),
              contents: historyContents,
              tools: tools,
            });

            let funcCalls = [];
            for await (const chunk of chunks) {
              if (chunk.functionCalls) {
                funcCalls.push(...chunk.functionCalls);
              }
`;
content = content.replace(streamStart, newStreamStart);

// Now we need to handle the funcCalls after the loop.
const streamEnd = /controller\.enqueue\([\s\S]*?encoder\.encode\(\`data: \$\{JSON\.stringify\(\{ token: '', done: true \}\)\}\\n\\n\`\)[\s\S]*?\);/g;

const newStreamEnd = `
            if (funcCalls.length > 0) {
              const call = funcCalls[0];
              if (call.name === 'create_stripe_package') {
                const { title, description, vendorCostUSD } = call.args;
                
                // 1. Calculate random markup between 27% and 39%
                const markup = 0.27 + Math.random() * 0.12;
                const retailPriceUSD = vendorCostUSD * (1 + markup);
                const retailPriceCents = Math.round(retailPriceUSD * 100);

                let paymentLink = '';
                try {
                  // 2. Create Stripe Package
                  const stripeRes = await createStripePackageLink({
                    title,
                    description,
                    retailPriceCents,
                  });
                  paymentLink = stripeRes.paymentLink;

                  // 3. Save to DB
                  await prisma.travelPackage.create({
                    data: {
                      userId,
                      title,
                      description,
                      wholesaleCost: vendorCostUSD,
                      markupPercentage: markup,
                      retailPrice: retailPriceUSD,
                      stripeProductId: stripeRes.productId,
                      stripePriceId: stripeRes.priceId,
                      stripePaymentLink: stripeRes.paymentLink,
                    }
                  });
                } catch (e) {
                  console.error('Failed to create stripe package:', e);
                  paymentLink = 'Error creating payment link.';
                }

                // Append function response to history and stream the final answer
                historyContents.push({
                  role: 'model',
                  parts: [{ functionCall: call }]
                });
                historyContents.push({
                  role: 'function',
                  parts: [{ functionResponse: { name: call.name, response: { paymentLink, retailPriceUSD: retailPriceUSD.toFixed(2) } } }]
                });

                const chunks2 = await genAI.models.generateContentStream({
                  model: configuredGeminiTextModel(),
                  contents: historyContents,
                  tools: tools,
                });

                for await (const chunk of chunks2) {
                  const token = chunk.text ?? '';
                  if (token) {
                    controller.enqueue(
                      encoder.encode(\`data: \${JSON.stringify({ token, done: false })}\\n\\n\`)
                    );
                  }
                }
              }
            }

            controller.enqueue(
              encoder.encode(\`data: \${JSON.stringify({ token: '', done: true })}\\n\\n\`)
            );
`;

content = content.replace(streamEnd, newStreamEnd);

// 5. Update the buffered path to support tools
const bufferedPath = /const response = await genAI\.models\.generateContent\(\{[\s\S]*?contents: \[\{ role: 'user', parts: \[\{ text: geminiPrompt \}\] \}\],[\s\S]*?\}\);/g;
const newBufferedPath = `
    const bufferedContents = [{ role: 'user', parts: [{ text: geminiPrompt }] }];
    let response = await genAI.models.generateContent({
      model: configuredGeminiTextModel(),
      contents: bufferedContents,
      tools: tools,
    });
    
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      if (call.name === 'create_stripe_package') {
         const { title, description, vendorCostUSD } = call.args;
         const markup = 0.27 + Math.random() * 0.12;
         const retailPriceUSD = vendorCostUSD * (1 + markup);
         const retailPriceCents = Math.round(retailPriceUSD * 100);
         
         let paymentLink = '';
         try {
           const stripeRes = await createStripePackageLink({ title, description, retailPriceCents });
           paymentLink = stripeRes.paymentLink;
           await prisma.travelPackage.create({
             data: {
               userId, title, description,
               wholesaleCost: vendorCostUSD, markupPercentage: markup,
               retailPrice: retailPriceUSD, stripeProductId: stripeRes.productId,
               stripePriceId: stripeRes.priceId, stripePaymentLink: stripeRes.paymentLink,
             }
           });
         } catch(e) {
           paymentLink = 'Error creating payment link.';
         }
         
         bufferedContents.push({ role: 'model', parts: [{ functionCall: call }] });
         bufferedContents.push({ role: 'function', parts: [{ functionResponse: { name: call.name, response: { paymentLink, retailPriceUSD: retailPriceUSD.toFixed(2) } } }] });
         
         response = await genAI.models.generateContent({
           model: configuredGeminiTextModel(),
           contents: bufferedContents,
           tools: tools,
         });
      }
    }
`;
content = content.replace(bufferedPath, newBufferedPath);

fs.writeFileSync('src/app/api/avatar/chat/route.ts', content);
console.log('Updated route.ts');
