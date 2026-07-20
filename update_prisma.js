const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf-8');

const packageModel = `

model TravelPackage {
  id                String   @id @default(uuid())
  userId            String
  title             String
  description       String
  wholesaleCost     Float
  markupPercentage  Float
  retailPrice       Float
  stripeProductId   String?
  stripePriceId     String?
  stripePaymentLink String?
  createdAt         DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
`;

if (!schema.includes('model TravelPackage')) {
  schema += packageModel;
  
  // Also add travelPackages to User model
  schema = schema.replace('  memories           Memory[]', '  memories           Memory[]\n  travelPackages     TravelPackage[]');
  
  fs.writeFileSync('prisma/schema.prisma', schema);
  console.log('Added TravelPackage to schema.prisma');
} else {
  console.log('TravelPackage already in schema.prisma');
}
