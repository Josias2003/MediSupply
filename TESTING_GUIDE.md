# MediSupply Manual Testing Guide

This file is for the person who will test the system manually.

## 1. Prerequisites

Install these first:

1. Node.js 20 or later
2. pnpm 10 or later
3. MySQL Server 8.x
4. MySQL Workbench or another MySQL client
5. A code editor such as VS Code

## 2. Local Installation

### Step 1: Install Node.js

1. Open https://nodejs.org/
2. Download the LTS version
3. Run the installer
4. Keep the default options
5. Finish the installation
6. Open a new terminal and run:

```powershell
node -v
npm -v
```

### Step 2: Install pnpm

Run:

```powershell
npm install -g pnpm
pnpm -v
```

### Step 3: Install MySQL

1. Open https://dev.mysql.com/downloads/installer/
2. Download MySQL Installer
3. Choose the `Developer Default` setup if available
4. Install MySQL Server and MySQL Workbench
5. During setup, keep note of:
   - MySQL username
   - MySQL password
   - Port, usually `3306`
6. After installation, open MySQL Workbench and confirm you can connect

### Step 4: Create the database

In MySQL Workbench, run:

```sql
CREATE DATABASE medisupply;
```

### Step 5: Configure the environment file

Open [.env](d:\medical-supply-platform\.env) and confirm these values:

```env
DATABASE_URL=mysql://YOUR_MYSQL_USER:YOUR_MYSQL_PASSWORD@localhost:3306/medisupply
JWT_SECRET=any-long-random-secret
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
```

If email testing is not ready yet, leave SMTP values empty. Core login still works for non-2FA users.

### Step 6: Install project dependencies

From the project root, run:

```powershell
pnpm install
```

### Step 7: Create tables and seed demo data

Run:

```powershell
pnpm db:push
pnpm db:seed
```

### Step 8: Start the app

Run:

```powershell
pnpm dev
```

Open:

`http://localhost:3000`

## 3. Demo Test Accounts

Use password:

`Password123!`

Recommended accounts for first testing:

- Procurement: `bikomeye9@gmail.com`
- Supplier: `nayihikisamuelnasri@gmail.com`
- Accountant: `vianew440@gmail.com`

Accounts with 2FA enabled:

- Admin: `sindnepom@gmail.com`
- Pharmacist: `blackhathackers2022@gmail.com`

Note:
Admin and pharmacist require an OTP email. If SMTP is not configured yet, focus first on procurement, supplier, and accountant flows.

## 4. Main Process Flow To Test

Test the system in this order so the workflow makes sense.

### Flow A: Procurement to Supplier to Accountant

This is the easiest full flow because it does not require OTP to start.

#### A1. Login as Procurement

1. Open the login page
2. Click the `Procurement` quick-fill button or enter:
   - Email: `bikomeye9@gmail.com`
   - Password: `Password123!`
3. Click `Continue to dashboard`
4. Confirm the Procurement dashboard loads

#### A2. Review requisitions

1. Open `Requisitions`
2. Find a requisition with status `approved`
3. Open it
4. Confirm the item list is visible
5. Click `Create PO`
6. Select a supplier
7. Set expected delivery date
8. Confirm quantities and unit costs
9. Click `Create Purchase Order`

Expected result:
The PO is created and appears in the `Purchase Orders` tab.

#### A3. Send PO to supplier

1. Go to `Purchase Orders`
2. Find the new PO with status `draft`
3. Click `Send to Supplier`

Expected result:
The PO status changes from `draft` to `sent`.

#### A4. Login as Supplier

1. Sign out
2. Login with:
   - Email: `nayihikisamuelnasri@gmail.com`
   - Password: `Password123!`
3. Open the Supplier dashboard

#### A5. Confirm the order

1. In `New Orders`, find the PO
2. Click `Confirm Order`

Expected result:
The order moves into active delivery work.

#### A6. Mark delivery

1. In `Active Deliveries`, find the same PO
2. Optionally add delivery notes
3. Click `Mark Delivered`

Expected result:
The PO moves to the area waiting for pharmacist receipt confirmation.

#### A7. Login as Pharmacist

Use this only if OTP email is working.

1. Sign out
2. Login with:
   - Email: `blackhathackers2022@gmail.com`
   - Password: `Password123!`
3. Enter the 6-digit OTP sent to email
4. Open the `Pending Deliveries` section
5. Open the delivered PO
6. Click `Confirm Receipt`
7. Review received quantities
8. Click `Confirm Receipt & Update Stock`

Expected result:
Inventory is updated and supplier can now submit an invoice.

#### A8. Supplier submits invoice

1. Sign out
2. Login again as supplier
3. Open the delivered PO
4. Confirm receipt status now allows invoicing
5. Click `Submit Invoice`
6. Enter amount and due date
7. Click `Submit Invoice`

Expected result:
A new invoice is created for finance.

#### A9. Accountant records payment

1. Sign out
2. Login with:
   - Email: `vianew440@gmail.com`
   - Password: `Password123!`
3. Open `Invoices`
4. Find the new invoice
5. Click `Pay`
6. Enter payment amount
7. Choose payment method
8. Add transaction reference if needed
9. Click `Confirm Payment`

Expected result:
Invoice status changes to `paid` or `partial` depending on the amount entered.

## 5. Additional Functional Tests

### Pharmacist tests

If OTP is configured, also test:

1. Inventory search
2. Log usage on an item
3. Check low-stock alerts
4. Check expiry alerts
5. Open `Requisitions`
6. Create or review a requisition

### Procurement tests

1. Approve a submitted requisition
2. Reject a submitted requisition with a reason
3. Open PO items
4. Use chat on requisitions and POs
5. Check order status changes

### Supplier tests

1. Decline an order with a reason
2. Mark partial delivery
3. Open notifications
4. Use PO chat

### Accountant tests

1. Filter invoices by status
2. Record a partial payment
3. Open `Budgets`
4. Create a new budget allocation
5. Review `Payments`

### Admin tests

If OTP is configured, also test:

1. Login as admin
2. Open `User Management`
3. Open `Suppliers`
4. Open `Audit Logs`
5. Confirm role-based access is correct

## 6. Password Reset Test

1. On the login page, click `Forgot password?`
2. Enter a known email
3. Click `Send reset link`
4. In development, check the server terminal output for the reset link if email is not fully configured
5. Open the reset link
6. Set a new password
7. Login with the new password

## 7. Smoke Test Checklist

Before sign-off, confirm:

- App opens on `http://localhost:3000`
- Login works
- Role-based menus are correct
- Procurement can create and send a PO
- Supplier can confirm and mark delivery
- Pharmacist can confirm receipt
- Supplier can submit invoice after receipt confirmation
- Accountant can record payment
- Notifications appear where expected
- No major UI crash happens during the flow

## 8. Important Notes

- Seeded data already includes sample inventory, requisitions, purchase orders, invoices, budgets, and notifications.
- The fastest non-OTP test path is Procurement -> Supplier -> Accountant.
- Full end-to-end operational testing needs the pharmacist account because receipt confirmation unlocks supplier invoicing.
