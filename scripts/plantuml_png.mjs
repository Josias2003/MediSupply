import fs from 'fs';
import zlib from 'zlib';
import https from 'https';

const code = `@startuml
left to right direction
skinparam packageStyle rectangle

actor "Admin" as admin
actor "Procurement Officer" as proc
actor "Supplier" as sup
actor "Pharmacist" as pharm
actor "Accountant" as acc

rectangle "MediSupply System" {
  usecase "Manage Users" as UC1
  usecase "View Audit Logs" as UC2
  usecase "Create/Review \\nRequisitions" as UC3
  usecase "Generate \\nPurchase Orders" as UC4
  usecase "Acknowledge Orders" as UC5
  usecase "Fulfill Delivery" as UC6
  usecase "Submit Invoices" as UC7
  usecase "Confirm Delivery \\nReceipt" as UC8
  usecase "Manage Stock & Alerts" as UC9
  usecase "Review & Pay \\nInvoices" as UC10
  usecase "Manage Budgets" as UC11
}

admin --> UC1
admin --> UC2
proc --> UC3
proc --> UC4
sup --> UC5
sup --> UC6
sup --> UC7
pharm --> UC8
pharm --> UC9
acc --> UC10
acc --> UC11

UC4 .> UC5 : <<include>>
UC6 .> UC8 : <<include>>
UC8 .> UC7 : <<include>>
UC7 .> UC10 : <<include>>
@enduml`;

function downloadPNG(plantUmlCode, outputPath) {
    return new Promise((resolve, reject) => {
        const data = Buffer.from(plantUmlCode.trim(), 'utf8');
        const compressed = zlib.deflateSync(data);
        const encoded = compressed.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const url = `https://kroki.io/plantuml/png/${encoded}`;
        
        https.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`Failed: ${res.statusCode}`));
            const fileStream = fs.createWriteStream(outputPath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
        }).on('error', reject);
    });
}

const outFile = 'C:\\\\Users\\\\HP\\\\.gemini\\\\antigravity\\\\brain\\\\b5989dc0-13d5-46c0-887a-96af1a9f7766\\\\diagrams_png\\\\7_UseCase_Diagram.png';
downloadPNG(code, outFile)
    .then(() => console.log('Successfully saved StarUML-styled Diagram to ' + outFile))
    .catch(console.error);
