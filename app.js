// Data keys for localStorage
const USERS_KEY = 'veg_market_users';
const VEGETABLES_KEY = 'veg_market_vegetables';
const TRANSACTIONS_KEY = 'veg_market_transactions';
const CURRENT_USER_KEY = 'veg_market_current_user';

// Initialize default data
function initData() {
    if (!localStorage.getItem(USERS_KEY)) {
        localStorage.setItem(USERS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(VEGETABLES_KEY)) {
        localStorage.setItem(VEGETABLES_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(TRANSACTIONS_KEY)) {
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([]));
    }
}
initData();

// Helper: get next ID for vegetables
function getNextVegId() {
    const veggies = JSON.parse(localStorage.getItem(VEGETABLES_KEY));
    return veggies.length > 0 ? Math.max(...veggies.map(v => v.id)) + 1 : 1;
}

// ========== USER FUNCTIONS ==========
function registerUser(name, mobile, role, balance) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    if (users.find(u => u.mobile == mobile)) {
        return false; // already exists
    }
    const newUser = {
        mobile: parseInt(mobile),
        name,
        role,
        balance: parseFloat(balance)
    };
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
}

function loginUser(mobile) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const user = users.find(u => u.mobile == mobile);
    if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
    window.location.href = 'index.html';
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
}

function updateUserBalance(mobile, newBalance) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const index = users.findIndex(u => u.mobile == mobile);
    if (index !== -1) {
        users[index].balance = newBalance;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        // If this is the current user, update current user too
        const current = getCurrentUser();
        if (current && current.mobile == mobile) {
            current.balance = newBalance;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
        }
    }
}

function getUserByMobile(mobile) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    return users.find(u => u.mobile == mobile);
}

// ========== VEGETABLE FUNCTIONS ==========
function addVegetable(name, pricePerKg, quantityKg) {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'FARMER') {
        alert('Only farmers can add vegetables.');
        return;
    }
    const veg = {
        id: getNextVegId(),
        name,
        pricePerKg: parseFloat(pricePerKg),
        quantityKg: parseFloat(quantityKg),
        farmerMobile: currentUser.mobile,
        farmerName: currentUser.name
    };
    const veggies = JSON.parse(localStorage.getItem(VEGETABLES_KEY));
    veggies.push(veg);
    localStorage.setItem(VEGETABLES_KEY, JSON.stringify(veggies));
    alert('Vegetable added successfully!');
}

function getAvailableVegetables() {
    const veggies = JSON.parse(localStorage.getItem(VEGETABLES_KEY));
    return veggies.filter(v => v.quantityKg > 0);
}

function getVegetablesByFarmer(mobile) {
    const veggies = JSON.parse(localStorage.getItem(VEGETABLES_KEY));
    return veggies.filter(v => v.farmerMobile == mobile);
}

function updateVegetableQuantity(vegId, newQuantity) {
    const veggies = JSON.parse(localStorage.getItem(VEGETABLES_KEY));
    const index = veggies.findIndex(v => v.id == vegId);
    if (index !== -1) {
        veggies[index].quantityKg = newQuantity;
        localStorage.setItem(VEGETABLES_KEY, JSON.stringify(veggies));
    }
}

// ========== TRANSACTION FUNCTIONS ==========
function addTransaction(transaction) {
    const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY));
    transactions.push(transaction);
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function getTransactionsForUser(mobile) {
    const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY));
    return transactions.filter(t => t.senderId == mobile || t.receiverId == mobile)
        .sort((a, b) => b.timestamp - a.timestamp);
}

// ========== CORE BUSINESS LOGIC ==========
// Renamed from buyVegetable to processBuy to avoid naming conflict
function processBuy(vegId, quantity) {
    const customer = getCurrentUser();
    if (!customer || customer.role !== 'CUSTOMER') {
        alert('Only customers can buy.');
        return;
    }

    const veggies = JSON.parse(localStorage.getItem(VEGETABLES_KEY));
    const veg = veggies.find(v => v.id == vegId);
    if (!veg || veg.quantityKg < quantity) {
        alert('Vegetable not available or insufficient quantity.');
        return;
    }

    const totalCost = veg.pricePerKg * quantity;
    if (customer.balance < totalCost) {
        alert('Insufficient balance.');
        return;
    }

    // Update balances
    const farmer = getUserByMobile(veg.farmerMobile);
    const newCustomerBalance = customer.balance - totalCost;
    const newFarmerBalance = farmer.balance + totalCost;

    updateUserBalance(customer.mobile, newCustomerBalance);
    updateUserBalance(farmer.mobile, newFarmerBalance);

    // Update vegetable quantity
    veg.quantityKg -= quantity;
    updateVegetableQuantity(veg.id, veg.quantityKg);

    // Record transaction
    const transaction = {
        id: Date.now(),
        type: 'BUY',
        senderId: customer.mobile,
        receiverId: farmer.mobile,
        amount: totalCost,
        vegetableName: veg.name,
        quantityKg: quantity,
        timestamp: Date.now()
    };
    addTransaction(transaction);

    alert(`Purchase successful! Paid ₹${totalCost.toFixed(2)}`);
}

function addMoneyToWallet(amount) {
    const user = getCurrentUser();
    if (!user) return;
    const newBalance = user.balance + amount;
    updateUserBalance(user.mobile, newBalance);

    // Record transaction
    const transaction = {
        id: Date.now(),
        type: 'ADD_MONEY',
        senderId: user.mobile,
        receiverId: user.mobile,
        amount: amount,
        timestamp: Date.now()
    };
    addTransaction(transaction);

    alert(`₹${amount} added successfully.`);
}

function transferMoney(senderMobile, receiverMobile, amount) {
    // This can be used from a separate transfer page or modal
    const sender = getUserByMobile(senderMobile);
    const receiver = getUserByMobile(receiverMobile);
    if (!sender || !receiver) {
        alert('User not found.');
        return false;
    }
    if (sender.balance < amount) {
        alert('Insufficient balance.');
        return false;
    }

    updateUserBalance(sender.mobile, sender.balance - amount);
    updateUserBalance(receiver.mobile, receiver.balance + amount);

    const transaction = {
        id: Date.now(),
        type: 'TRANSFER',
        senderId: sender.mobile,
        receiverId: receiver.mobile,
        amount: amount,
        timestamp: Date.now()
    };
    addTransaction(transaction);
    alert('Transfer successful.');
    return true;
}

function undoLastTransaction() {
    const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY));
    if (transactions.length === 0) {
        alert('No transaction to undo.');
        return;
    }

    const lastTx = transactions.pop(); // remove last
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));

    // Reverse the effect
    switch (lastTx.type) {
        case 'ADD_MONEY':
            const user = getUserByMobile(lastTx.senderId);
            updateUserBalance(user.mobile, user.balance - lastTx.amount);
            break;
        case 'TRANSFER':
            const sender = getUserByMobile(lastTx.senderId);
            const receiver = getUserByMobile(lastTx.receiverId);
            updateUserBalance(sender.mobile, sender.balance + lastTx.amount);
            updateUserBalance(receiver.mobile, receiver.balance - lastTx.amount);
            break;
        case 'BUY':
            // Restore balances
            const customer = getUserByMobile(lastTx.senderId);
            const farmer = getUserByMobile(lastTx.receiverId);
            updateUserBalance(customer.mobile, customer.balance + lastTx.amount);
            updateUserBalance(farmer.mobile, farmer.balance - lastTx.amount);
            // Restore vegetable quantity
            const veggies = JSON.parse(localStorage.getItem(VEGETABLES_KEY));
            const veg = veggies.find(v => v.name === lastTx.vegetableName && v.farmerMobile == lastTx.receiverId);
            if (veg) {
                veg.quantityKg += lastTx.quantityKg;
                localStorage.setItem(VEGETABLES_KEY, JSON.stringify(veggies));
            }
            break;
    }
    alert('Last transaction undone.');
}

function getTopUsers(k) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    return users.sort((a, b) => b.balance - a.balance).slice(0, k);
}

// ========== UI RENDERING FUNCTIONS ==========
function loadFarmerDashboard() {
    const user = getCurrentUser();
    if (!user || user.role !== 'FARMER') {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('userInfo').innerHTML = `Welcome, ${user.name} (Farmer)`;
    document.getElementById('balance').innerText = `₹${user.balance.toFixed(2)}`;

    // My vegetables
    const myVeggies = getVegetablesByFarmer(user.mobile);
    const vegDiv = document.getElementById('myVegetables');
    if (myVeggies.length === 0) {
        vegDiv.innerHTML = '<div class="empty-message">No vegetables added yet.</div>';
    } else {
        vegDiv.innerHTML = myVeggies.map(v => `
            <div class="vegetable-item">
                <span class="veg-name">${v.name}</span>
                <span class="veg-details">₹${v.pricePerKg}/kg (${v.quantityKg} kg left)</span>
            </div>
        `).join('');
    }

    // Transaction history
    const txs = getTransactionsForUser(user.mobile);
    const historyDiv = document.getElementById('transactionHistory');
    if (txs.length === 0) {
        historyDiv.innerHTML = '<div class="empty-message">No transactions yet.</div>';
    } else {
        historyDiv.innerHTML = txs.map(tx => {
            let desc = '';
            if (tx.type === 'ADD_MONEY') desc = `Added ₹${tx.amount}`;
            else if (tx.type === 'TRANSFER') desc = `Sent ₹${tx.amount} to ${getUserByMobile(tx.receiverId)?.name}`;
            else if (tx.type === 'BUY') desc = `Sold ${tx.quantityKg}kg ${tx.vegetableName} for ₹${tx.amount}`;
            return `<div class="history-item">${new Date(tx.timestamp).toLocaleString()}: ${desc}</div>`;
        }).join('');
    }
}

function loadCustomerDashboard() {
    const user = getCurrentUser();
    if (!user || user.role !== 'CUSTOMER') {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('userInfo').innerHTML = `Welcome, ${user.name} (Customer)`;
    document.getElementById('balance').innerText = `₹${user.balance.toFixed(2)}`;

    // Available vegetables
    const available = getAvailableVegetables();
    const vegList = document.getElementById('vegetableList');
    if (available.length === 0) {
        vegList.innerHTML = '<div class="empty-message">No vegetables available.</div>';
    } else {
        vegList.innerHTML = available.map(v => {
            return `
                <div class="vegetable-item" data-veg-id="${v.id}">
                    <div class="veg-info">
                        <div class="veg-name">${v.name}</div>
                        <div class="veg-details">
                            <span>₹${v.pricePerKg}/kg</span>
                            <span>${v.quantityKg} kg left</span>
                            by ${v.farmerName}
                        </div>
                    </div>
                    <div class="buy-controls">
                        <input type="number" class="quantity-input" min="0.1" max="${v.quantityKg}" step="0.1" value="1">
                        <button class="buy-btn" onclick="buyVegetable(${v.id}, this.parentElement.querySelector('.quantity-input').value)">Buy</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Top users
    const topUsers = getTopUsers(5);
    const topDiv = document.getElementById('topUsers');
    if (topUsers.length === 0) {
        topDiv.innerHTML = '<div class="empty-message">No users yet.</div>';
    } else {
        topDiv.innerHTML = topUsers.map((u, i) => `
            <div class="user-item">
                <div class="user-info">
                    <span class="user-rank">${i+1}</span>
                    <div class="user-details">
                        <span class="user-name">${u.name}</span>
                        <span class="user-role">${u.role}</span>
                    </div>
                </div>
                <span class="user-balance">₹${u.balance.toFixed(2)}</span>
            </div>
        `).join('');
    }

    // Transaction history
    const txs = getTransactionsForUser(user.mobile);
    const historyDiv = document.getElementById('transactionHistory');
    if (txs.length === 0) {
        historyDiv.innerHTML = '<div class="empty-message">No transactions yet.</div>';
    } else {
        historyDiv.innerHTML = txs.map(tx => {
            let icon = '🔄';
            let desc = '';
            if (tx.type === 'ADD_MONEY') {
                icon = '➕';
                desc = `Added ₹${tx.amount}`;
            } else if (tx.type === 'TRANSFER') {
                if (tx.senderId == user.mobile) {
                    icon = '⬆️';
                    desc = `Sent ₹${tx.amount} to ${getUserByMobile(tx.receiverId)?.name}`;
                } else {
                    icon = '⬇️';
                    desc = `Received ₹${tx.amount} from ${getUserByMobile(tx.senderId)?.name}`;
                }
            } else if (tx.type === 'BUY') {
                icon = '🛍️';
                desc = `Bought ${tx.quantityKg}kg ${tx.vegetableName} for ₹${tx.amount}`;
            }
            return `
                <div class="history-item">
                    <div class="history-desc">
                        <span class="history-icon">${icon}</span>
                        <span class="history-text">${desc}</span>
                    </div>
                    <span class="history-time">${new Date(tx.timestamp).toLocaleString()}</span>
                </div>
            `;
        }).join('');
    }
}

// Make functions global for inline onclick handlers
window.buyVegetable = function(vegId, quantity) {
    if (!quantity) return;
    quantity = parseFloat(quantity);
    if (isNaN(quantity) || quantity <= 0) {
        alert('Invalid quantity.');
        return;
    }
    processBuy(vegId, quantity);
    loadCustomerDashboard();
};

window.undo = function() {
    undoLastTransaction();
    // Reload appropriate dashboard
    const user = getCurrentUser();
    if (user) {
        if (user.role === 'FARMER') loadFarmerDashboard();
        else loadCustomerDashboard();
    }
};

window.logout = logout;