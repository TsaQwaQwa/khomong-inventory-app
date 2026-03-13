# Tataiso ya Mosebetsi (Non-Admin) - Kgomong

Tokomane ena e ruta mosebetsi (eo eseng admin) hore na sisteme e sebetsa jwang letsatsi le letsatsi.

## 1) Sisteme ena e etsa eng?

Sisteme e thusa ho:
- rekota thekiso (cash, card, EFT),
- rekota thekiso ya akhaonto ya moreki (tab),
- rekota ditefo tsa akhaonto,
- rekota thepa e rekilweng ho supplier,
- rekota stock adjustments (spillage, breakage, freebies, correction),
- bona boemo ba stock, alerts le exceptions.

Stock e balwa ka bo yona ka:
- `Purchases` (stock e eketseha),
- `Sales / Account charges` (stock e fokotseha),
- `Adjustments` (e ka eketsa kapa ea fokotsa).

## 2) Dintho tseo mosebetsi (non-admin) a lokelang ho di sebelisa

Sebedisa tsena ka menu e kaholimo:
- `Daily Overview`
- `Products & Prices`
- `Stock Purchases`
- `Suppliers`
- `Purchase Assistant`
- `Stock Adjustments`
- `Exceptions`
- `Alerts`
- `Transactions`
- `Customer Accounts`

## 3) Dintho tse sa etsweng ke non-admin

- `Reports` le `Audit Trail` ke tsa admin feela.
- Ho hlakola (`Delete`) supplier / product / customer / purchase hangata ke admin feela.

Ha o sa bone konopo e itseng, hangata ke hobane tokelo eo ke ya admin.

## 4) Tshebetso ya letsatsi le letsatsi (order e kgothaletswang)

1. Bula `Daily Overview` ho bona hore na ho na le stock e tlase kapa out of stock.
2. Bula `Stock Purchases` ebe o kenya thepa e keneng.
3. Letsatsing lohle:
   - rekota `Direct Sale` ho `Transactions`,
   - rekota `Account Sale` le `Account Payment` ho `Customer Accounts`.
4. Ha ho na tahlehelo kapa phoso ya stock, kenya ho `Stock Adjustments`.
5. Qetellong ya letsatsi sheba `Alerts` le `Exceptions` ho netefatsa hore ha ho bothata bo salang.

## 5) Mehato ya bohlokwa ka bonngwe

### A) Rekota Direct Sale
1. Eya ho `Transactions`.
2. Tobetsa konopo ya quick action (`+`) kapa bula form ya `Direct Sale`.
3. Kenya `Items Sold` (product + qty).
4. Kgetha `Payment Method` (`Cash` / `Card` / `EFT`).
5. Ha e le cash, kenya tjhelete e amohetsweng, netefatsa change.
6. Tobetsa `Save`.

### B) Rekota Sale ho Customer Account (Tab)
1. Eya ho `Customer Accounts`.
2. Kgetha `Add Sale to Account`.
3. Kgetha customer.
4. Kenya lihlahisoa le quantity.
5. Tobetsa `Save`.

### C) Rekota Payment ya Customer Account
1. Eya ho `Customer Accounts`.
2. Kgetha `Add Account Payment`.
3. Kgetha customer le amount.
4. Kgetha payment method.
5. Tobetsa `Save`.

### D) Rekota Stock Purchase
1. Eya ho `Stock Purchases`.
2. Kgetha `Add Purchase` (kapa `Repeat Last Purchase` haeba invoice e tshwana haholo).
3. Kgetha supplier (optional), kenya invoice number (optional).
4. Kenya items:
   - product,
   - cases,
   - singles,
   - total ya line.
5. Tobetsa `Save`.

Barcode:
- Sebedisa `Scan Barcode` field.
- Scan ebe o tobetsa `Enter` (kapa `Add`).
- Scan e nngwe le e nngwe e eketsa `1 single unit`.

### E) Rekota Stock Adjustment
1. Eya ho `Stock Adjustments`.
2. Kgetha reason (`Spillage`, `Breakage`, `Freebies`, `Count Correction`, jj.).
3. Kenya units:
   - negative (`-`) bakeng sa tahlehelo,
   - positive (`+`) bakeng sa keketseho.
4. Kenya note haeba ho hlokahala.
5. Tobetsa `Save`.

### F) Sebedisa Alerts le Exceptions
- `Alerts`: tobetsa alert hore e o ise moo bothata bo leng teng.
- `Exceptions`: bontsha out of stock, no price, overdue tabs, negative stock.
- Tsena di thusa ho lokisa mathata kapele.

## 6) Network

- App e hloka network ho bula data le ho boloka diphetoho.
- Ha server kapa network e sa fumanehe, leka hape ha connection e kgutla.

## 7) Ha o entse phoso transaction

- O ka sebelisa `Reverse` ho transaction history (ha konopo e le teng).
- Kenya reason pele o netefatsa.
- Sena se etsa reversal record; ha se hlakole histori.

## 8) Mokgwa wa ho ruta ka screenshots (numbered)

U ka nka screenshots ebe o beha dinomoro ho tsona. Sebedisa template ena:

### Screenshot 1: Main Navigation
- `1` = `Daily Overview`
- `2` = `Stock Purchases`
- `3` = `Transactions`
- `4` = `Customer Accounts`
- `5` = `Stock Adjustments`
- `6` = `Alerts`
- `7` = `Exceptions`
- `8` = `+` (Quick Actions)

### Screenshot 2: Direct Sale Form
- `1` Kgetha product
- `2` Kenya quantity
- `3` Kgetha payment method
- `4` (Cash feela) Kenya cash received
- `5` Tobetsa `Save`

### Screenshot 3: Add Purchase Form
- `1` Supplier
- `2` Invoice number
- `3` Scan Barcode
- `4` Items table (cases/singles/units/total)
- `5` Add item
- `6` Save

### Screenshot 4: Customer Accounts
- `1` Add Sale to Account
- `2` Add Account Payment
- `3` Customer list le balance
- `4` Statement / reminder tools

### Screenshot 5: Stock Adjustments
- `1` Product
- `2` Reason
- `3` Units (+/-)
- `4` Note
- `5` Save

## 9) Checklist e kgutshwane ya mosebetsi

Letsatsi le leng le le leng netefatsa:
- [ ] Purchases tsohle di kentsoe
- [ ] Direct sales tsohle di kentsoe
- [ ] Account sales le payments di kentsoe
- [ ] Adjustments di kentsoe (ha ho hlokahala)
- [ ] Alerts/Exceptions di shebilwe
