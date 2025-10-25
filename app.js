// ==================== ตัวแปรหลัก ====================
let transactions = [];
let categories = {
    'รายรับ': ['เงินเดือน', 'ค่าสอนพิเศษ', 'โบนัส', 'ดอกเบี้ย', 'อื่นๆ'],
    'รายจ่าย': ['อาหาร', 'ค่าเดินทาง', 'ค่าน้ำค่าไฟ', 'การศึกษา', 'สุขภาพ', 'ช้อปปิ้ง', 'บันเทิง', 'อื่นๆ']
};
let isOnline = navigator.onLine;
let pendingSync = [];
let sheetsConfig = {
    spreadsheetId: '',
    apiKey: '',
    connected: false
};

// ==================== เริ่มต้นแอพ ====================
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    loadFromLocalStorage();
    setupEventListeners();
    updateOnlineStatus();
    setCurrentDate();
    updateCategories();
    renderHistory();
    updateSummary();
    loadSheetsConfig();
    
    // ตรวจสอบสถานะออนไลน์
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

// ==================== โหลดข้อมูล ====================
function loadFromLocalStorage() {
    const savedTransactions = localStorage.getItem('transactions');
    const savedCategories = localStorage.getItem('categories');
    const savedPending = localStorage.getItem('pendingSync');
    
    if (savedTransactions) {
        transactions = JSON.parse(savedTransactions);
    }
    
    if (savedCategories) {
        categories = JSON.parse(savedCategories);
    }
    
    if (savedPending) {
        pendingSync = JSON.parse(savedPending);
    }
}

function saveToLocalStorage() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('categories', JSON.stringify(categories));
    localStorage.setItem('pendingSync', JSON.stringify(pendingSync));
}

function loadSheetsConfig() {
    const savedConfig = localStorage.getItem('sheetsConfig');
    if (savedConfig) {
        sheetsConfig = JSON.parse(savedConfig);
        if (sheetsConfig.connected) {
            document.getElementById('spreadsheetId').value = sheetsConfig.spreadsheetId;
            document.getElementById('connectBtn').style.display = 'none';
            document.getElementById('disconnectBtn').style.display = 'block';
            showStatus('เชื่อมต่อกับ Google Sheets แล้ว', 'success', 'connectionStatus');
        }
    }
}

function saveSheetsConfig() {
    localStorage.setItem('sheetsConfig', JSON.stringify(sheetsConfig));
}

// ==================== จัดการ Event ====================
function setupEventListeners() {
    // แท็บเมนู
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // ปุ่มประเภท
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectType(this.dataset.type);
        });
    });
    
    // ฟอร์มบันทึก
    document.getElementById('transactionForm').addEventListener('submit', handleSubmit);
    
    // สรุปผล
    document.getElementById('summaryPeriod').addEventListener('change', updateSummary);
    
    // ค้นหาประวัติ
    document.getElementById('searchHistory').addEventListener('input', renderHistory);
    document.getElementById('filterType').addEventListener('change', renderHistory);
    
    // ตั้งค่า
    document.getElementById('connectBtn').addEventListener('click', connectGoogleSheets);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectGoogleSheets);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('clearBtn').addEventListener('click', clearAllData);
    document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
    
    // เปลี่ยนหมวดหมู่ตามประเภท
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', updateCategories);
    });
}

// ==================== สลับแท็บ ====================
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    if (tabName === 'summary') {
        updateSummary();
    } else if (tabName === 'history') {
        renderHistory();
    } else if (tabName === 'settings') {
        renderCategoryManager();
    }
}

// ==================== เลือกประเภท ====================
function selectType(type) {
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('type').value = type;
    updateCategories();
}

// ==================== อัพเดทหมวดหมู่ ====================
function updateCategories() {
    const type = document.getElementById('type').value;
    const categorySelect = document.getElementById('category');
    
    categorySelect.innerHTML = '<option value="">-- เลือกหมวดหมู่ --</option>';
    
    categories[type].forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
}

// ==================== ตั้งวันที่ปัจจุบัน ====================
function setCurrentDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// ==================== บันทึกรายการ ====================
function handleSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const transaction = {
        id: Date.now().toString(),
        type: formData.get('type'),
        amount: parseFloat(formData.get('amount')),
        category: formData.get('category'),
        date: formData.get('date'),
        note: formData.get('note'),
        synced: false,
        createdAt: new Date().toISOString()
    };
    
    transactions.unshift(transaction);
    saveToLocalStorage();
    
    // เพิ่มเข้าคิวซิงค์
    if (sheetsConfig.connected) {
        pendingSync.push(transaction);
        saveToLocalStorage();
        if (isOnline) {
            syncToGoogleSheets();
        }
    }
    
    // รีเซ็ตฟอร์ม
    e.target.reset();
    setCurrentDate();
    document.querySelector('.type-btn').click();
    
    // แจ้งเตือน
    showNotification('✅ บันทึกสำเร็จ');
    
    // อัพเดทหน้าจอ
    renderHistory();
    updateSummary();
}

// ==================== แสดงประวัติ ====================
function renderHistory() {
    const historyList = document.getElementById('historyList');
    const searchTerm = document.getElementById('searchHistory').value.toLowerCase();
    const filterType = document.getElementById('filterType').value;
    
    let filtered = transactions.filter(t => {
        const matchSearch = t.category.toLowerCase().includes(searchTerm) || 
                          (t.note && t.note.toLowerCase().includes(searchTerm));
        const matchType = filterType === 'all' || t.type === filterType;
        return matchSearch && matchType;
    });
    
    if (filtered.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <p>📭</p>
                <p>ยังไม่มีรายการ</p>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = filtered.map(t => `
        <div class="history-item ${t.type === 'รายรับ' ? 'income' : 'expense'}">
            <div class="history-info">
                <div class="history-type">${t.type}</div>
                <div class="history-category">${t.category}</div>
                ${t.note ? `<div class="history-note">${t.note}</div>` : ''}
                <div class="history-date">${formatDate(t.date)}</div>
            </div>
            <div class="history-amount ${t.type === 'รายรับ' ? 'income' : 'expense'}">
                ${t.type === 'รายรับ' ? '+' : '-'}${formatNumber(t.amount)}
            </div>
            <div class="history-actions">
                <button class="edit-btn" onclick="editTransaction('${t.id}')">✏️</button>
                <button class="delete-btn" onclick="deleteTransaction('${t.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ==================== แก้ไขรายการ ====================
function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    
    // สลับไปหน้าบันทึก
    switchTab('record');
    
    // เติมข้อมูล
    document.querySelector(`[data-type="${transaction.type}"]`).click();
    document.getElementById('amount').value = transaction.amount;
    document.getElementById('category').value = transaction.category;
    document.getElementById('date').value = transaction.date;
    document.getElementById('note').value = transaction.note || '';
    
    // ลบรายการเก่า
    deleteTransaction(id, false);
    
    showNotification('📝 กำลังแก้ไขรายการ');
}

// ==================== ลบรายการ ====================
function deleteTransaction(id, confirm = true) {
    if (confirm && !window.confirm('ต้องการลบรายการนี้?')) {
        return;
    }
    
    transactions = transactions.filter(t => t.id !== id);
    saveToLocalStorage();
    renderHistory();
    updateSummary();
    
    if (confirm) {
        showNotification('🗑️ ลบรายการแล้ว');
    }
}

// ==================== อัพเดทสรุปผล ====================
function updateSummary() {
    const period = document.getElementById('summaryPeriod').value;
    const filtered = filterByPeriod(transactions, period);
    
    const income = filtered
        .filter(t => t.type === 'รายรับ')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = filtered
        .filter(t => t.type === 'รายจ่าย')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = income - expense;
    
    document.getElementById('totalIncome').textContent = formatNumber(income);
    document.getElementById('totalExpense').textContent = formatNumber(expense);
    document.getElementById('netBalance').textContent = formatNumber(balance);
    
    // สรุปตามหมวดหมู่
    renderCategoryBreakdown(filtered);
}

function renderCategoryBreakdown(filtered) {
    const breakdown = {};
    
    filtered.forEach(t => {
        if (!breakdown[t.category]) {
            breakdown[t.category] = { income: 0, expense: 0 };
        }
        if (t.type === 'รายรับ') {
            breakdown[t.category].income += t.amount;
        } else {
            breakdown[t.category].expense += t.amount;
        }
    });
    
    const container = document.getElementById('categoryBreakdown');
    
    if (Object.keys(breakdown).length === 0) {
        container.innerHTML = '<div class="empty-state"><p>ยังไม่มีข้อมูล</p></div>';
        return;
    }
    
    container.innerHTML = Object.entries(breakdown)
        .map(([category, amounts]) => {
            const total = amounts.income + amounts.expense;
            return `
                <div class="category-item">
                    <span class="category-name">${category}</span>
                    <span class="category-amount">${formatNumber(total)} บาท</span>
                </div>
            `;
        })
        .join('');
}

// ==================== กรองตามช่วงเวลา ====================
function filterByPeriod(data, period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return data.filter(t => {
        const date = new Date(t.date);
        
        switch(period) {
            case 'today':
                return date >= today;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return date >= weekAgo;
            case 'month':
                return date.getMonth() === now.getMonth() && 
                       date.getFullYear() === now.getFullYear();
            case 'year':
                return date.getFullYear() === now.getFullYear();
            case 'all':
            default:
                return true;
        }
    });
}

// ==================== Google Sheets ====================
function connectGoogleSheets() {
    const spreadsheetId = document.getElementById('spreadsheetId').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    
    if (!spreadsheetId) {
        showStatus('กรุณาใส่ Spreadsheet ID', 'error', 'connectionStatus');
        return;
    }
    
    sheetsConfig.spreadsheetId = spreadsheetId;
    sheetsConfig.apiKey = apiKey;
    sheetsConfig.connected = true;
    
    saveSheetsConfig();
    
    document.getElementById('connectBtn').style.display = 'none';
    document.getElementById('disconnectBtn').style.display = 'block';
    
    showStatus('เชื่อมต่อสำเร็จ! (หมายเหตุ: การซิงค์จริงต้องตั้งค่า Google Apps Script)', 'success', 'connectionStatus');
    
    // ซิงค์ข้อมูลทั้งหมด
    if (isOnline) {
        pendingSync = [...transactions];
        saveToLocalStorage();
        syncToGoogleSheets();
    }
}

function disconnectGoogleSheets() {
    if (!confirm('ต้องการยกเลิกการเชื่อมต่อ?')) {
        return;
    }
    
    sheetsConfig.connected = false;
    saveSheetsConfig();
    
    document.getElementById('connectBtn').style.display = 'block';
    document.getElementById('disconnectBtn').style.display = 'none';
    
    showStatus('ยกเลิกการเชื่อมต่อแล้ว', 'success', 'connectionStatus');
}

async function syncToGoogleSheets() {
    if (!sheetsConfig.connected || !isOnline || pendingSync.length === 0) {
        return;
    }
    
    updateSyncStatus('กำลังซิงค์...');
    
    try {
        // หมายเหตุ: ต้องสร้าง Google Apps Script Web App แยกต่างหาก
        // ตัวอย่างนี้แสดงโครงสร้างการส่งข้อมูล
        
        const response = await fetch(`https://script.google.com/macros/s/AKfycbx2sQpoult5m1cfZ78Ubw-hhrK_7hSQaglfxAmRspkU0wk-VIRs89A40gp7eLJXKed8/exec`, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                spreadsheetId: sheetsConfig.spreadsheetId,
                transactions: pendingSync
            })
        });
        
        // ทำเครื่องหมายว่าซิงค์แล้ว
        pendingSync.forEach(pending => {
            const t = transactions.find(tr => tr.id === pending.id);
            if (t) t.synced = true;
        });
        
        pendingSync = [];
        saveToLocalStorage();
        
        updateSyncStatus('ซิงค์สำเร็จ ✓');
        setTimeout(() => updateSyncStatus(''), 3000);
        
    } catch (error) {
        console.error('Sync error:', error);
        updateSyncStatus('ซิงค์ล้มเหลว');
    }
}

// ==================== สถานะออนไลน์/ออฟไลน์ ====================
function updateOnlineStatus() {
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');
    
    if (isOnline) {
        statusBar.classList.remove('offline');
        statusBar.classList.add('online');
        statusText.textContent = '🌐 ออนไลน์';
    } else {
        statusBar.classList.remove('online');
        statusBar.classList.add('offline');
        statusText.textContent = '📡 ออฟไลน์';
    }
}

function handleOnline() {
    isOnline = true;
    updateOnlineStatus();
    syncToGoogleSheets();
}

function handleOffline() {
    isOnline = false;
    updateOnlineStatus();
}

function updateSyncStatus(message) {
    document.getElementById('syncStatus').textContent = message;
}

// ==================== จัดการหมวดหมู่ ====================
function renderCategoryManager() {
    const container = document.getElementById('categoryManager');
    
    container.innerHTML = `
        <h4>รายรับ</h4>
        ${categories['รายรับ'].map(cat => `
            <div class="category-manager-item">
                <span>${cat}</span>
                ${categories['รายรับ'].length > 1 ? `<button onclick="deleteCategory('รายรับ', '${cat}')">ลบ</button>` : ''}
            </div>
        `).join('')}
        
        <h4 style="margin-top: 20px;">รายจ่าย</h4>
        ${categories['รายจ่าย'].map(cat => `
            <div class="category-manager-item">
                <span>${cat}</span>
                ${categories['รายจ่าย'].length > 1 ? `<button onclick="deleteCategory('รายจ่าย', '${cat}')">ลบ</button>` : ''}
            </div>
        `).join('')}
    `;
}

function addCategory() {
    const input = document.getElementById('newCategory');
    const categoryName = input.value.trim();
    
    if (!categoryName) {
        alert('กรุณาใส่ชื่อหมวดหมู่');
        return;
    }
    
    const type = document.getElementById('type').value;
    
    if (categories[type].includes(categoryName)) {
        alert('หมวดหมู่นี้มีอยู่แล้ว');
        return;
    }
    
    categories[type].push(categoryName);
    saveToLocalStorage();
    
    input.value = '';
    renderCategoryManager();
    updateCategories();
    
    showNotification('✅ เพิ่มหมวดหมู่แล้ว');
}

function deleteCategory(type, categoryName) {
    if (!confirm(`ต้องการลบหมวดหมู่ "${categoryName}"?`)) {
        return;
    }
    
    categories[type] = categories[type].filter(c => c !== categoryName);
    saveToLocalStorage();
    
    renderCategoryManager();
    updateCategories();
    
    showNotification('🗑️ ลบหมวดหมู่แล้ว');
}

// ==================== ส่งออก/นำเข้าข้อมูล ====================
function exportData() {
    const data = {
        transactions,
        categories,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `รายรับรายจ่าย_${formatDate(new Date())}.json`;
    a.click();
    
    showNotification('📤 ส่งออกข้อมูลสำเร็จ');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            
            if (confirm('การนำเข้าจะแทนที่ข้อมูลเดิม ต้องการดำเนินการต่อ?')) {
                transactions = data.transactions || [];
                categories = data.categories || categories;
                
                saveToLocalStorage();
                renderHistory();
                updateSummary();
                renderCategoryManager();
                
                showNotification('📥 นำเข้าข้อมูลสำเร็จ');
            }
        } catch (error) {
            alert('ไฟล์ไม่ถูกต้อง');
        }
    };
    reader.readAsText(file);
    
    e.target.value = '';
}

function clearAllData() {
    if (!confirm('ต้องการลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
        return;
    }
    
    if (!confirm('ยืนยันอีกครั้ง: ลบข้อมูลทั้งหมดจริงๆ?')) {
        return;
    }
    
    transactions = [];
    pendingSync = [];
    saveToLocalStorage();
    
    renderHistory();
    updateSummary();
    
    showNotification('🗑️ ลบข้อมูลทั้งหมดแล้ว');
}

// ==================== ฟังก์ชันช่วยเหลือ ====================
function formatNumber(num) {
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
                   'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function showNotification(message) {
    // สร้าง notification แบบง่าย
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: #323232;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showStatus(message, type, elementId) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = 'block';
}

// ==================== Style สำหรับ Animation ====================
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
