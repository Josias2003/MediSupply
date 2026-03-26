import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema.js";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const DATABASE_URL = process.env.DATABASE_URL;

function daysAgo(n) { return new Date(Date.now() - n * 86400000); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection, { schema, mode: "default" });

  try {
    console.log("🌱 Seeding MediSupply Rwanda...\n");

    // ── USERS ────────────────────────────────────────────────────
    console.log("👤 Creating users...");
    const pw = await bcrypt.hash("Password123!", 10);
    await db.insert(schema.users).values([
  { 
    openId: "local_admin_001", 
    email: "sindnepom@gmail.com", 
    name: "System Administrator", 
    passwordHash: pw, 
    role: "admin", 
    isActive: true, 
    lastLogin: new Date("2026-03-14 18:38:19"), 
    twoFactorEnabled: true 
  },
  { 
    openId: "local_pharm_001", 
    email: "blackhathackers2022@gmail.com", 
    name: "Joy Bagabo", 
    passwordHash: pw, 
    role: "pharmacist", 
    isActive: true, 
    lastLogin: new Date("2026-03-14 18:39:09"), 
    twoFactorEnabled: true 
  },
  { 
    openId: "local_proc_001", 
    email: "bikomeye9@gmail.com", 
    name: "Josias A", 
    passwordHash: pw, 
    role: "procurement_officer", 
    isActive: true, 
    lastLogin: new Date("2026-03-14 18:39:09"), 
    twoFactorEnabled: false 
  },
  { 
    openId: "local_acct_001", 
    email: "vianew440@gmail.com", 
    name: "Frank A", 
    passwordHash: pw, 
    role: "accountant", 
    isActive: true, 
    lastLogin: new Date("2026-03-14 18:39:09"), 
    twoFactorEnabled: false 
  },
  { 
    openId: "local_supp_001", 
    email: "nayihikisamuelnasri@gmail.com", 
    name: "Nasri", 
    passwordHash: pw, 
    role: "supplier", 
    isActive: true, 
    lastLogin: new Date("2026-03-14 18:39:09"), 
    supplierId: 1, 
    twoFactorEnabled: false 
  },
]).onDuplicateKeyUpdate({ set: { name: schema.users.name } });

    // ── SUPPLIERS ────────────────────────────────────────────────
    console.log("🏢 Creating suppliers...");
    await db.insert(schema.suppliers).values([
      { id:1, userId:5, name:"Rwanda Pharma Distributors Ltd", contactPerson:"Robert Bizimana", email:"supplier@medisupply.com",    phone:"+250 788 100 001", city:"Kigali",   country:"Rwanda", paymentTerms:"Net 30", averageDeliveryDays:5,  rating:"4.50", totalOrders:24, isActive:true },
      { id:2,           name:"East Africa Medical Supplies",   contactPerson:"Diane Uwase",     email:"info@eams.rw",              phone:"+250 788 100 002", city:"Kigali",   country:"Rwanda", paymentTerms:"Net 14", averageDeliveryDays:3,  rating:"4.20", totalOrders:18, isActive:true },
      { id:3,           name:"MediLink International",         contactPerson:"Samuel Nkurunziza",email:"sales@medilink.co.rw",     phone:"+250 788 100 003", city:"Huye",     country:"Rwanda", paymentTerms:"Net 45", averageDeliveryDays:7,  rating:"3.80", totalOrders:9,  isActive:true },
      { id:4,           name:"Kigali Drug Wholesalers",        contactPerson:"Ange Ingabire",   email:"orders@kdw.rw",            phone:"+250 788 100 004", city:"Kigali",   country:"Rwanda", paymentTerms:"Net 30", averageDeliveryDays:2,  rating:"4.70", totalOrders:31, isActive:true },
    ]).onDuplicateKeyUpdate({ set: { name: schema.suppliers.name } });

    // ── MEDICAL SUPPLIES ─────────────────────────────────────────
    console.log("💊 Creating medical supplies...");
    const supplies = [
      { code:"MED-001", name:"Paracetamol 500mg",         category:"Analgesic",        unit:"tablets",  currentStock:850,  reorderPoint:200, reorderQuantity:500, unitCost:"45",    supplierId:1, batchNumber:"B2024-001", storageLocation:"Shelf A1", expiryDate:daysFromNow(365) },
      { code:"MED-002", name:"Ibuprofen 400mg",            category:"Analgesic",        unit:"tablets",  currentStock:320,  reorderPoint:100, reorderQuantity:300, unitCost:"85",    supplierId:1, batchNumber:"B2024-002", storageLocation:"Shelf A2", expiryDate:daysFromNow(300) },
      { code:"MED-003", name:"Amoxicillin 250mg",          category:"Antibiotic",       unit:"capsules", currentStock:180,  reorderPoint:80,  reorderQuantity:200, unitCost:"120",   supplierId:2, batchNumber:"B2024-003", storageLocation:"Shelf B1", expiryDate:daysFromNow(280) },
      { code:"MED-004", name:"Artemether-Lumefantrine",    category:"Antimalarial",     unit:"tablets",  currentStock:95,   reorderPoint:150, reorderQuantity:400, unitCost:"350",   supplierId:1, batchNumber:"B2024-004", storageLocation:"Shelf B2", expiryDate:daysFromNow(420) },
      { code:"MED-005", name:"ORS Sachets",                category:"Rehydration",      unit:"sachets",  currentStock:1200, reorderPoint:300, reorderQuantity:600, unitCost:"25",    supplierId:4, batchNumber:"B2024-005", storageLocation:"Shelf C1", expiryDate:daysFromNow(500) },
      { code:"MED-006", name:"Metronidazole 400mg",        category:"Antibiotic",       unit:"tablets",  currentStock:440,  reorderPoint:100, reorderQuantity:250, unitCost:"75",    supplierId:2, batchNumber:"B2024-006", storageLocation:"Shelf B3", expiryDate:daysFromNow(310) },
      { code:"MED-007", name:"IV Normal Saline 500ml",     category:"IV Fluids",        unit:"bags",     currentStock:65,   reorderPoint:80,  reorderQuantity:150, unitCost:"850",   supplierId:3, batchNumber:"B2024-007", storageLocation:"Store R1", expiryDate:daysFromNow(180) },
      { code:"MED-008", name:"Ciprofloxacin 500mg",        category:"Antibiotic",       unit:"tablets",  currentStock:210,  reorderPoint:60,  reorderQuantity:150, unitCost:"180",   supplierId:2, batchNumber:"B2024-008", storageLocation:"Shelf B4", expiryDate:daysFromNow(390) },
      { code:"MED-009", name:"Hydrocortisone Cream 1%",    category:"Dermatology",      unit:"tubes",    currentStock:88,   reorderPoint:30,  reorderQuantity:80,  unitCost:"1200",  supplierId:4, batchNumber:"B2024-009", storageLocation:"Shelf D1", expiryDate:daysFromNow(240) },
      { code:"MED-010", name:"Salbutamol Inhaler",         category:"Respiratory",      unit:"inhalers", currentStock:42,   reorderPoint:20,  reorderQuantity:50,  unitCost:"3500",  supplierId:3, batchNumber:"B2024-010", storageLocation:"Shelf D2", expiryDate:daysFromNow(200) },
      { code:"MED-011", name:"Doxycycline 100mg",          category:"Antibiotic",       unit:"capsules", currentStock:145,  reorderPoint:50,  reorderQuantity:120, unitCost:"95",    supplierId:2, batchNumber:"B2024-011", storageLocation:"Shelf B5", expiryDate:daysFromNow(350) },
      { code:"MED-012", name:"Amlodipine 5mg",             category:"Cardiovascular",   unit:"tablets",  currentStock:380,  reorderPoint:80,  reorderQuantity:200, unitCost:"65",    supplierId:1, batchNumber:"B2024-012", storageLocation:"Shelf E1", expiryDate:daysFromNow(460) },
      { code:"MED-013", name:"Metformin 500mg",            category:"Diabetes",         unit:"tablets",  currentStock:520,  reorderPoint:100, reorderQuantity:300, unitCost:"55",    supplierId:1, batchNumber:"B2024-013", storageLocation:"Shelf E2", expiryDate:daysFromNow(430) },
      { code:"MED-014", name:"Ferrous Sulfate 200mg",      category:"Haematology",      unit:"tablets",  currentStock:690,  reorderPoint:150, reorderQuantity:400, unitCost:"30",    supplierId:4, batchNumber:"B2024-014", storageLocation:"Shelf F1", expiryDate:daysFromNow(510) },
      { code:"MED-015", name:"Folic Acid 5mg",             category:"Vitamins",         unit:"tablets",  currentStock:870,  reorderPoint:200, reorderQuantity:500, unitCost:"20",    supplierId:4, batchNumber:"B2024-015", storageLocation:"Shelf F2", expiryDate:daysFromNow(540) },
      { code:"MED-016", name:"Omeprazole 20mg",            category:"Gastroenterology", unit:"capsules", currentStock:295,  reorderPoint:70,  reorderQuantity:180, unitCost:"110",   supplierId:3, batchNumber:"B2024-016", storageLocation:"Shelf G1", expiryDate:daysFromNow(320) },
      { code:"MED-017", name:"Ringer's Lactate 500ml",     category:"IV Fluids",        unit:"bags",     currentStock:40,   reorderPoint:60,  reorderQuantity:120, unitCost:"950",   supplierId:3, batchNumber:"B2024-017", storageLocation:"Store R2", expiryDate:daysFromNow(160), },
      { code:"MED-018", name:"Gloves Nitrile (M)",         category:"Consumables",      unit:"boxes",    currentStock:75,   reorderPoint:30,  reorderQuantity:100, unitCost:"4500",  supplierId:4, batchNumber:"B2024-018", storageLocation:"Store S1", expiryDate:daysFromNow(730) },
      { code:"MED-019", name:"Surgical Masks",             category:"Consumables",      unit:"boxes",    currentStock:120,  reorderPoint:40,  reorderQuantity:100, unitCost:"3200",  supplierId:4, batchNumber:"B2024-019", storageLocation:"Store S2", expiryDate:daysFromNow(700) },
      { code:"MED-020", name:"Quinine 600mg IV",           category:"Antimalarial",     unit:"vials",    currentStock:28,   reorderPoint:20,  reorderQuantity:60,  unitCost:"4200",  supplierId:1, batchNumber:"B2024-020", storageLocation:"Cold C1",  expiryDate:daysFromNow(25)  },
    ];
    for (const s of supplies) {
      await db.insert(schema.medicalSupplies).values(s).onDuplicateKeyUpdate({ set: { currentStock: s.currentStock } });
    }

    // ── INVENTORY TRANSACTIONS (90 days history for forecasting) ─
    console.log("📦 Creating inventory transactions (90 days)...");
    const usageProfiles = [
      { supplyId:1,  avgDaily:18, variance:6  }, // Paracetamol — high
      { supplyId:2,  avgDaily:8,  variance:3  }, // Ibuprofen
      { supplyId:3,  avgDaily:5,  variance:2  }, // Amoxicillin
      { supplyId:4,  avgDaily:12, variance:5  }, // Artemether (malaria)
      { supplyId:5,  avgDaily:22, variance:8  }, // ORS
      { supplyId:6,  avgDaily:7,  variance:2  }, // Metronidazole
      { supplyId:7,  avgDaily:4,  variance:2  }, // IV Saline
      { supplyId:8,  avgDaily:4,  variance:1  }, // Ciprofloxacin
      { supplyId:9,  avgDaily:2,  variance:1  }, // Hydrocortisone
      { supplyId:10, avgDaily:1,  variance:1  }, // Inhaler
      { supplyId:11, avgDaily:3,  variance:1  }, // Doxycycline
      { supplyId:12, avgDaily:9,  variance:3  }, // Amlodipine
      { supplyId:13, avgDaily:11, variance:4  }, // Metformin
      { supplyId:14, avgDaily:14, variance:5  }, // Ferrous Sulfate
      { supplyId:15, avgDaily:16, variance:6  }, // Folic Acid
      { supplyId:16, avgDaily:5,  variance:2  }, // Omeprazole
      { supplyId:17, avgDaily:3,  variance:1  }, // Ringer's
      { supplyId:18, avgDaily:1,  variance:1  }, // Gloves
      { supplyId:19, avgDaily:2,  variance:1  }, // Masks
      { supplyId:20, avgDaily:2,  variance:1  }, // Quinine
    ];
    const txBatch = [];
    for (const p of usageProfiles) {
      for (let d = 89; d >= 0; d--) {
        const qty = Math.max(1, Math.round(p.avgDaily + (Math.random() - 0.5) * p.variance * 2));
        txBatch.push({
          supplyId: p.supplyId, transactionType: "usage", quantity: qty,
          userId: 2, createdAt: daysAgo(d),
          notes: "Daily dispensing"
        });
      }
      // A few purchase transactions
      for (let i = 0; i < 3; i++) {
        txBatch.push({
          supplyId: p.supplyId, transactionType: "purchase", quantity: rand(100, 400),
          userId: 3, createdAt: daysAgo(rand(10, 80)),
          notes: "Stock replenishment"
        });
      }
    }
    // Insert in chunks of 200
    for (let i = 0; i < txBatch.length; i += 200) {
      await db.insert(schema.inventoryTransactions).values(txBatch.slice(i, i + 200)).catch(() => {});
    }
    console.log(`   → ${txBatch.length} transactions created`);

    // ── PURCHASE REQUISITIONS ────────────────────────────────────
    console.log("📋 Creating purchase requisitions...");
    const reqs = [
      { requisitionNumber:"REQ-1001", createdBy:2, status:"approved",       approvedBy:1, approvalDate:daysAgo(25), totalAmount:"280000", notes:"Monthly antimalarial restock" },
      { requisitionNumber:"REQ-1002", createdBy:2, status:"approved",       approvedBy:1, approvalDate:daysAgo(18), totalAmount:"145000", notes:"IV fluids urgent restock" },
      { requisitionNumber:"REQ-1003", createdBy:2, status:"converted_to_po", approvedBy:1, approvalDate:daysAgo(40), totalAmount:"520000", notes:"Quarterly antibiotic order" },
      { requisitionNumber:"REQ-1004", createdBy:2, status:"submitted",      totalAmount:"95000",  notes:"Consumables replenishment" },
      { requisitionNumber:"REQ-1005", createdBy:2, status:"draft",          totalAmount:"60000",  notes:"Vitamins and supplements" },
      { requisitionNumber:"REQ-1006", createdBy:2, status:"rejected",       rejectionReason:"Budget exceeded this quarter. Please resubmit next month.", totalAmount:"380000", notes:"Cardiovascular meds" },
    ];
    for (const r of reqs) {
      await db.insert(schema.purchaseRequisitions).values(r).onDuplicateKeyUpdate({ set: { status: r.status } });
    }
    // Req items
    const reqItems = [
      { requisitionId:1, supplyId:4,  quantity:400, estimatedUnitCost:"350"  },
      { requisitionId:1, supplyId:20, quantity:60,  estimatedUnitCost:"4200" },
      { requisitionId:2, supplyId:7,  quantity:100, estimatedUnitCost:"850"  },
      { requisitionId:2, supplyId:17, quantity:80,  estimatedUnitCost:"950"  },
      { requisitionId:3, supplyId:3,  quantity:200, estimatedUnitCost:"120"  },
      { requisitionId:3, supplyId:8,  quantity:150, estimatedUnitCost:"180"  },
      { requisitionId:3, supplyId:11, quantity:120, estimatedUnitCost:"95"   },
      { requisitionId:4, supplyId:18, quantity:10,  estimatedUnitCost:"4500" },
      { requisitionId:4, supplyId:19, quantity:10,  estimatedUnitCost:"3200" },
      { requisitionId:5, supplyId:14, quantity:400, estimatedUnitCost:"30"   },
      { requisitionId:5, supplyId:15, quantity:500, estimatedUnitCost:"20"   },
      { requisitionId:6, supplyId:12, quantity:200, estimatedUnitCost:"65"   },
      { requisitionId:6, supplyId:13, quantity:300, estimatedUnitCost:"55"   },
    ];
    for (const item of reqItems) {
      await db.insert(schema.requisitionItems).values(item).catch(() => {});
    }

    // ── PURCHASE ORDERS ──────────────────────────────────────────
    console.log("🛒 Creating purchase orders...");
    const pos = [
      { id:1, poNumber:"PO-2024-001", supplierId:1, createdBy:3, status:"delivered",        totalAmount:"2450000", requisitionId:3, expectedDeliveryDate:daysAgo(20), deliveryDate:daysAgo(22), notes:"Urgent antibiotic order" },
      { id:2, poNumber:"PO-2024-002", supplierId:2, createdBy:3, status:"delivered",        totalAmount:"1380000", expectedDeliveryDate:daysAgo(15), deliveryDate:daysAgo(14), notes:"IV fluid supply" },
      { id:3, poNumber:"PO-2024-003", supplierId:4, createdBy:3, status:"delivered",        totalAmount:"875000",  expectedDeliveryDate:daysAgo(8),  deliveryDate:daysAgo(8),  notes:"Consumables" },
      { id:4, poNumber:"PO-2024-004", supplierId:1, createdBy:3, status:"partial_delivery", totalAmount:"980000",  requisitionId:1, expectedDeliveryDate:daysAgo(2),  notes:"Antimalarial drugs" },
      { id:5, poNumber:"PO-2024-005", supplierId:3, createdBy:3, status:"acknowledged",     totalAmount:"1260000", expectedDeliveryDate:daysFromNow(5), notes:"Analgesics and respiratory" },
      { id:6, poNumber:"PO-2024-006", supplierId:2, createdBy:3, status:"sent",             totalAmount:"540000",  requisitionId:2, expectedDeliveryDate:daysFromNow(3), notes:"IV fluids restock" },
      { id:7, poNumber:"PO-2024-007", supplierId:4, createdBy:3, status:"draft",            totalAmount:"320000",  expectedDeliveryDate:daysFromNow(7), notes:"Vitamins and minerals" },
    ];
    for (const po of pos) {
      await db.insert(schema.purchaseOrders).values(po).onDuplicateKeyUpdate({ set: { status: po.status } });
    }
    // PO items
    const poItems = [
      { poId:1, supplyId:3,  quantity:200, unitCost:"120",  deliveredQuantity:200 },
      { poId:1, supplyId:8,  quantity:150, unitCost:"180",  deliveredQuantity:150 },
      { poId:1, supplyId:11, quantity:120, unitCost:"95",   deliveredQuantity:120 },
      { poId:2, supplyId:7,  quantity:100, unitCost:"850",  deliveredQuantity:100 },
      { poId:2, supplyId:17, quantity:80,  unitCost:"950",  deliveredQuantity:80  },
      { poId:3, supplyId:18, quantity:10,  unitCost:"4500", deliveredQuantity:10  },
      { poId:3, supplyId:19, quantity:10,  unitCost:"3200", deliveredQuantity:10  },
      { poId:4, supplyId:4,  quantity:400, unitCost:"350",  deliveredQuantity:200 },
      { poId:4, supplyId:20, quantity:60,  unitCost:"4200", deliveredQuantity:30  },
      { poId:5, supplyId:1,  quantity:500, unitCost:"45",   deliveredQuantity:0   },
      { poId:5, supplyId:10, quantity:50,  unitCost:"3500", deliveredQuantity:0   },
      { poId:6, supplyId:7,  quantity:150, unitCost:"850",  deliveredQuantity:0   },
      { poId:7, supplyId:14, quantity:400, unitCost:"30",   deliveredQuantity:0   },
      { poId:7, supplyId:15, quantity:500, unitCost:"20",   deliveredQuantity:0   },
    ];
    for (const item of poItems) {
      await db.insert(schema.poItems).values(item).catch(() => {});
    }

    // ── INVOICES ─────────────────────────────────────────────────
    console.log("🧾 Creating invoices...");
    const invData = [
      { invoiceNumber:"INV-2024-001", poId:1, supplierId:1, totalAmount:"2450000", paidAmount:"2450000", status:"paid",    dueDate:daysAgo(10), invoiceDate:daysAgo(20) },
      { invoiceNumber:"INV-2024-002", poId:2, supplierId:2, totalAmount:"1380000", paidAmount:"1380000", status:"paid",    dueDate:daysAgo(5),  invoiceDate:daysAgo(14) },
      { invoiceNumber:"INV-2024-003", poId:3, supplierId:4, totalAmount:"875000",  paidAmount:"500000",  status:"partial", dueDate:daysFromNow(5),  invoiceDate:daysAgo(8)  },
      { invoiceNumber:"INV-2024-004", poId:4, supplierId:1, totalAmount:"980000",  paidAmount:"0",       status:"pending", dueDate:daysFromNow(10), invoiceDate:daysAgo(2)  },
      { invoiceNumber:"INV-2024-005", poId:5, supplierId:3, totalAmount:"1260000", paidAmount:"0",       status:"pending", dueDate:daysFromNow(20), invoiceDate:daysAgo(1)  },
    ];
    for (const inv of invData) {
      await db.insert(schema.invoices).values(inv).onDuplicateKeyUpdate({ set: { status: inv.status } });
    }

    // ── PAYMENTS ─────────────────────────────────────────────────
    console.log("💳 Creating payment records...");
    await db.insert(schema.payments).values([
      { invoiceId:1, amount:"2450000", paymentMethod:"bank_transfer", transactionReference:"TXN-BK-00234", paymentDate:daysAgo(12), notes:"Full payment via BK Ibanking" },
      { invoiceId:2, amount:"1380000", paymentMethod:"bank_transfer", transactionReference:"TXN-BK-00251", paymentDate:daysAgo(6),  notes:"Full payment cleared" },
      { invoiceId:3, amount:"500000",  paymentMethod:"check",         transactionReference:"CHK-0892",     paymentDate:daysAgo(4),  notes:"Partial — balance due in 5 days" },
    ]).catch(() => {});

    // ── BUDGETS ──────────────────────────────────────────────────
    console.log("💰 Creating budget allocations...");
    await db.insert(schema.budgets).values([
      { department:"Pharmacy",         allocatedAmount:"15000000", spentAmount:"8245000",  fiscalYear:2024, notes:"Annual pharmacy drug budget" },
      { department:"Emergency Dept",   allocatedAmount:"8000000",  spentAmount:"4120000",  fiscalYear:2024, notes:"Emergency medication and IV fluids" },
      { department:"Maternal Health",  allocatedAmount:"5000000",  spentAmount:"2890000",  fiscalYear:2024, notes:"Antenatal and delivery supplies" },
      { department:"General Ward",     allocatedAmount:"6000000",  spentAmount:"3540000",  fiscalYear:2024, notes:"General medical supplies" },
      { department:"Administration",   allocatedAmount:"2000000",  spentAmount:"1100000",  fiscalYear:2024, notes:"Consumables and PPE" },
    ]).catch(() => {});

    // ── FORECASTS ────────────────────────────────────────────────
    console.log("🤖 Creating sample forecasts...");
    await db.insert(schema.forecasts).values([
      { supplyId:4,  forecastPeriod:"2024-08", predictedQuantity:380, confidence:"0.87", method:"ml",                    dataPointsUsed:90 },
      { supplyId:1,  forecastPeriod:"2024-08", predictedQuantity:540, confidence:"0.91", method:"ml",                    dataPointsUsed:90 },
      { supplyId:7,  forecastPeriod:"2024-08", predictedQuantity:130, confidence:"0.82", method:"exponential_smoothing", dataPointsUsed:90 },
      { supplyId:17, forecastPeriod:"2024-08", predictedQuantity:95,  confidence:"0.79", method:"ml",                    dataPointsUsed:88 },
      { supplyId:14, forecastPeriod:"2024-08", predictedQuantity:420, confidence:"0.89", method:"linear",                dataPointsUsed:90 },
    ]).catch(() => {});

    // ── NOTIFICATIONS ────────────────────────────────────────────
    console.log("🔔 Creating sample notifications...");
    await db.insert(schema.notifications).values([
      { userId:1, type:"low_stock",       title:"Low Stock: Artemether-Lumefantrine",   message:"Current stock (95) is below reorder point (150). Malaria season approaching.", referenceId:4,  isRead:false },
      { userId:1, type:"low_stock",       title:"Low Stock: IV Normal Saline",           message:"Current stock (65) is below reorder point (80). Urgent restock needed.",       referenceId:7,  isRead:false },
      { userId:2, type:"low_stock",       title:"Low Stock: Artemether-Lumefantrine",   message:"Stock at 95 — below reorder point of 150. Submit requisition.",                referenceId:4,  isRead:false },
      { userId:1, type:"approval_pending",title:"Requisition REQ-1004 Submitted",       message:"Jean-Paul Habimana submitted REQ-1004 for consumables (RWF 95,000).",          referenceId:4,  isRead:false },
      { userId:3, type:"order_update",    title:"PO-2024-004 Partial Delivery",         message:"Supplier confirmed partial delivery of antimalarial drugs.",                    referenceId:4,  isRead:true  },
      { userId:4, type:"payment_due",     title:"Invoice INV-2024-003 Balance Due",     message:"Remaining balance of RWF 375,000 due in 5 days.",                              referenceId:3,  isRead:false },
      { userId:1, type:"expiry_warning",  title:"Expiring Soon: Quinine 600mg IV",      message:"Batch B2024-020 expires in 25 days. Use or return to supplier.",               referenceId:20, isRead:false },
      { userId:2, type:"expiry_warning",  title:"Expiring Soon: Quinine 600mg IV",      message:"Batch B2024-020 expires in 25 days.",                                          referenceId:20, isRead:false },
    ]).catch(() => {});

    // ── NOTIFICATION PREFERENCES ─────────────────────────────────
    console.log("⚙️  Setting notification preferences...");
    await db.insert(schema.notificationPreferences).values([
      { userId:1, lowStockAlerts:true, expiryWarnings:true, approvalAlerts:true, orderUpdates:true, budgetAlerts:true, emailNotifications:true },
      { userId:2, lowStockAlerts:true, expiryWarnings:true, approvalAlerts:true, orderUpdates:true, budgetAlerts:false, emailNotifications:true },
      { userId:3, lowStockAlerts:false, expiryWarnings:false, approvalAlerts:true, orderUpdates:true, budgetAlerts:false, emailNotifications:true },
      { userId:4, lowStockAlerts:false, expiryWarnings:false, approvalAlerts:false, orderUpdates:false, budgetAlerts:true, emailNotifications:true },
      { userId:5, lowStockAlerts:false, expiryWarnings:false, approvalAlerts:false, orderUpdates:true, budgetAlerts:false, emailNotifications:true },
    ]).onDuplicateKeyUpdate({ set: { emailNotifications: schema.notificationPreferences.emailNotifications } });

    console.log("\n✅ Seeding complete!\n");
    console.log("─────────────────────────────────────────");
    console.log("Demo accounts (password: Password123!)");
    console.log("  admin@medisupply.com       → Admin");
    console.log("  pharmacist@medisupply.com  → Pharmacist");
    console.log("  procurement@medisupply.com → Procurement Officer");
    console.log("  accountant@medisupply.com  → Accountant");
    console.log("  supplier@medisupply.com    → Supplier (Rwanda Pharma Distributors)");
    console.log("─────────────────────────────────────────");
    console.log("Data seeded:");
    console.log(`  ${supplies.length} medical supplies`);
    console.log(`  ${txBatch.length} inventory transactions (90-day history)`);
    console.log("  7 purchase orders (various statuses)");
    console.log("  5 invoices (paid, partial, pending)");
    console.log("  5 budgets by department");
    console.log("  AI forecasts ready to generate\n");

  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seed();
