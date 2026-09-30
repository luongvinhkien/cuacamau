const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money = value => new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + ' ₫';
const ymd = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function toast(message) { const el = $('#toast'); el.textContent = message; el.className = 'toast'; setTimeout(() => el.className = '', 3000); }
async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Lỗi HTTP ${response.status}`);
  return data;
}
let currentPage = 'live';
async function render(page = currentPage) {
  currentPage = page;
  const content = $('#content');
  try {
    if (page === 'customers') await catalog(content, 'customers');
    else if (page === 'products') await catalog(content, 'products');
    else if (page === 'orders') await orders(content);
    else if (page === 'picking') await picking(content);
    else if (page === 'reports') await reports(content);
    else if (page === 'password') password(content);
    else live(content);
  } catch (error) { toast(error.message); }
}
function live(content) {
  content.innerHTML = `<h1>🎙 Chốt đơn livestream</h1><section class="card"><label>Câu chốt đơn<textarea id="orderText" placeholder="Ví dụ: Lyna Fashion chốt Cua Size 2 1 kg 380k"></textarea></label><div class="row"><button id="listenOrder" class="primary">🎙️ Nói để chốt đơn</button><button id="parseOrder">Phân tích câu</button></div><p class="muted">Nếu TikTok LIVE đang dùng microphone, hãy nhập bằng tay hoặc dùng điện thoại thứ hai.</p><hr><h2>Nhập nhanh không cần giọng nói</h2><div class="quick-order-fields"><label>Khách hàng<input id="manualCustomer" autocomplete="off" placeholder="Nhập tên hoặc tên Zalo"><div id="manualCustomerSuggestions" class="customer-suggestions"></div></label><label>Sản phẩm<input id="manualProduct" placeholder="Tên sản phẩm"></label><label>Size<input id="manualSize" placeholder="Size"></label><label>Kg<input id="manualWeight" type="number" min="0" step="0.001" value="0"></label><label>Số tiền<input id="manualPrice" type="number" min="0" step="1" placeholder="Ví dụ: 380000"></label></div><button id="manualReview" class="primary">Kiểm tra đơn nhập nhanh</button><div id="orderPreview"></div></section>`;

  const bindCustomerSuggestions = (input, list, onChoose, onTyping = () => {}) => {
    let timer;
    let matches = [];
    input.addEventListener('input', () => {
      onTyping();
      clearTimeout(timer);
      const query = input.value.trim();
      list.innerHTML = '';
      if (!query) return;
      timer = setTimeout(async () => {
        try {
          matches = await api(`customers?q=${encodeURIComponent(query)}`);
          list.innerHTML = matches.map(c => `<button type="button" class="customer-suggestion" data-id="${c.id}"><strong>${esc(c.name)}</strong>${c.zaloName ? ` · Zalo: ${esc(c.zaloName)}` : ''}<small>${esc(c.phone || 'Chưa có SĐT')}</small></button>`).join('');
        } catch (error) { toast(error.message); }
      }, 180);
    });
    list.onclick = e => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      const chosen = matches.find(c => String(c.id) === id);
      if (!chosen) return;
      input.value = chosen.name || '';
      list.innerHTML = '';
      onChoose(chosen);
    };
  };

  let manualCustomer = null;
  bindCustomerSuggestions($('#manualCustomer'), $('#manualCustomerSuggestions'), customer => { manualCustomer = customer; }, () => { manualCustomer = null; });

  const showPreview = (parsed, products) => {
    const product = products.find(p => p.name?.toLowerCase() === parsed.productName?.toLowerCase() && (!parsed.size || String(p.size) === String(parsed.size)) && (!parsed.color || p.color?.toLowerCase() === parsed.color.toLowerCase()));
    let selectedCustomerId = parsed.matchType === 'exact' ? parsed.customerId : null;
    $('#orderPreview').innerHTML = `<h2>Xác nhận đơn</h2><div class="quick-order-fields"><label>Khách hàng<input id="pName" autocomplete="off" value="${esc(parsed.customerName)}"><div id="previewCustomerSuggestions" class="customer-suggestions"></div></label><label>Size<input id="pSize" value="${esc(parsed.size)}"></label><label>Kg<input id="pWeight" type="number" min="0" step="0.001" value="${parsed.weightKg}"></label><label>Số tiền<input id="pPrice" type="number" min="0" step="1" value="${parsed.price}"></label></div><div class="grid"><label>Sản phẩm<input id="pProduct" value="${esc(parsed.productName)}"></label><label>Màu<input id="pColor" value="${esc(parsed.color)}"></label><label>Số lượng<input id="pQty" type="number" min="1" value="${parsed.quantity}"></label><label>SĐT<input id="pPhone" value="${esc(parsed.matchType === 'exact' ? parsed.phone : '')}"></label><label>Địa chỉ<input id="pAddress" value="${esc(parsed.matchType === 'exact' ? parsed.address : '')}"></label></div><button id="confirmOrder" class="success">✓ Xác nhận đơn</button>`;
    bindCustomerSuggestions($('#pName'), $('#previewCustomerSuggestions'), customer => {
      selectedCustomerId = customer.id;
      $('#pPhone').value = customer.phone || '';
      $('#pAddress').value = customer.address || '';
    }, () => {
      selectedCustomerId = null;
      $('#pPhone').value = '';
      $('#pAddress').value = '';
    });
    $('#confirmOrder').onclick = async () => {
      try {
        const productName = $('#pProduct').value.trim();
        const selectedProduct = products.find(p => p.name?.toLowerCase() === productName.toLowerCase() && (!$('#pSize').value || String(p.size) === $('#pSize').value) && (!$('#pColor').value || p.color?.toLowerCase() === $('#pColor').value.toLowerCase()));
        await api('orders', { method: 'POST', body: JSON.stringify({ customerId: selectedCustomerId ? Number(selectedCustomerId) : null, customerName: $('#pName').value.trim(), phone: $('#pPhone').value.trim() || null, address: $('#pAddress').value.trim() || null, items: [{ productId: selectedProduct?.id ?? null, productName, color: $('#pColor').value.trim() || null, size: $('#pSize').value.trim() || null, quantity: Number($('#pQty').value), weightKg: Number($('#pWeight').value), price: Number($('#pPrice').value) }] }) });
        toast('Đã lưu đơn hàng');
        render('live');
      } catch (error) { toast(error.message); }
    };
  };

  $('#parseOrder').onclick = async () => {
    try {
      const parsed = await api('orders/parse', { method: 'POST', body: JSON.stringify({ text: $('#orderText').value }) });
      showPreview(parsed, await api('products'));
    } catch (error) { toast(error.message); }
  };
  $('#manualReview').onclick = async () => {
    const customerName = $('#manualCustomer').value.trim();
    const productName = $('#manualProduct').value.trim();
    if (!customerName || !productName) { toast('Nhập tên khách hàng và sản phẩm trước.'); return; }
    const customer = manualCustomer && manualCustomer.name === customerName ? manualCustomer : null;
    const parsed = { customerName, productName, size: $('#manualSize').value.trim(), color: '', quantity: 1, weightKg: Number($('#manualWeight').value || 0), price: Number($('#manualPrice').value || 0), customerId: customer?.id ?? null, phone: customer?.phone ?? null, address: customer?.address ?? null, matchType: customer ? 'exact' : 'new' };
    showPreview(parsed, await api('products'));
  };
  $('#listenOrder').onclick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast('Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome hoặc nhập câu chốt bằng tay.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = true;
    recognition.continuous = false;
    const button = $('#listenOrder');
    button.disabled = true;
    button.textContent = '🔴 Đang nghe...';
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0].transcript).join(' ').trim();
      $('#orderText').value = transcript;
      if (event.results[event.results.length - 1].isFinal) $('#parseOrder').click();
    };
    recognition.onerror = event => toast(event.error === 'not-allowed' ? 'Hãy cho phép trình duyệt dùng microphone.' : 'Không nhận được giọng nói. Bạn có thể nhập câu chốt bằng tay.');
    recognition.onend = () => { button.disabled = false; button.textContent = '🎙️ Nói để chốt đơn'; };
    try { recognition.start(); } catch { button.disabled = false; button.textContent = '🎙️ Nói để chốt đơn'; toast('Không thể mở microphone. Hãy thử lại hoặc nhập bằng tay.'); }
  };
}function init() {
  if (location.search) history.replaceState(null, document.title, location.pathname);
  const form = $('#loginForm');
  form.onsubmit = async event => {
    event.preventDefault();
    const error = $('#loginError'); error.textContent = '';
    const values = Object.fromEntries(new FormData(form));
    try {
      await api('auth/login', { method: 'POST', body: JSON.stringify(values) });
      $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
      $('#who').textContent = values.userName; render('live');
    } catch (err) { error.textContent = err.message; }
  };
  $('#nav').onclick = event => { const page = event.target.closest('[data-page]')?.dataset.page; if (page) render(page); };
  $('#logout').onclick = async () => { try { await api('auth/logout', { method: 'POST' }); } finally { location.href = '/'; } };
}

function modal(title,fields,value,save){let d=$('#modal');d.innerHTML=`<h2>${title}</h2><form id="form">${fields.map(f=>`<label>${f.label}<input name="${f.k}" type="${f.t||'text'}" value="${esc(value?.[f.k])}" ${f.required?'required':''}></label>`).join('')}<button class="primary">Lưu</button> <button type="button" id="close">Đóng</button></form>`;d.showModal();$('#close').onclick=()=>d.close();$('#form').onsubmit=async e=>{e.preventDefault();await save(Object.fromEntries(new FormData(e.target)));d.close();render()}}
async function catalog(c,type){let cust=type==='customers',base=type,data=await api(base),fields=cust?[{k:'code',label:'Mã khách'},{k:'name',label:'Tên khách',required:true},{k:'phone',label:'Số điện thoại'},{k:'zaloName',label:'Tên Zalo'},{k:'address',label:'Địa chỉ'},{k:'note',label:'Ghi chú'}]:[{k:'code',label:'Mã sản phẩm'},{k:'name',label:'Tên',required:true},{k:'color',label:'Màu'},{k:'size',label:'Size'},{k:'price',label:'Giá',t:'number'},{k:'stock',label:'Tồn kho',t:'number'},{k:'note',label:'Ghi chú'}];c.innerHTML=`<h1>${cust?'Khách hàng':'Sản phẩm'}</h1><div class="card row"><input id="search" placeholder="Tìm kiếm"><button id="add" class="primary">＋ Thêm</button></div><div class="tablewrap"><table><thead><tr>${(cust?['Mã','Tên','SĐT','Tên Zalo','Địa chỉ','Ghi chú','Thao tác']:['Mã','Tên','Màu','Size','Giá','Tồn','Thao tác']).map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody id="rows"></tbody></table></div>`;function draw(q=''){let a=data.filter(x=>JSON.stringify(x).toLowerCase().includes(q.toLowerCase()));$('#rows').innerHTML=a.map(x=>`<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td>${cust?`<td>${esc(x.phone)}</td><td>${esc(x.zaloName)}</td><td>${esc(x.address)}</td><td>${esc(x.note)}</td>`:`<td>${esc(x.color)}</td><td>${esc(x.size)}</td><td>${money(x.price)}</td><td>${x.stock}</td>`}<td><button data-e="${x.id}">Sửa</button> <button data-d="${x.id}">Xóa</button>${cust?` <button data-h="${x.id}">Lịch sử</button>`:''}</td></tr>`).join('')||'<tr><td>Chưa có dữ liệu</td></tr>'}draw();$('#search').oninput=e=>draw(e.target.value);$('#add').onclick=()=>modal('Thêm mới',fields,{},v=>api(base,{method:'POST',body:JSON.stringify(v)}));$('#rows').onclick=async e=>{let id=e.target.dataset.e||e.target.dataset.d||e.target.dataset.h,x=data.find(z=>z.id==id);if(e.target.dataset.e)modal('Sửa',fields,x,v=>api(`${base}/${id}`,{method:'PUT',body:JSON.stringify(v)}));if(e.target.dataset.d&&confirm('Xóa mục này?'))try{await api(`${base}/${id}`,{method:'DELETE'});render()}catch(z){toast(z.message)}if(e.target.dataset.h){let h=await api(`customers/${id}/history`);alert(h.orders.map(o=>`${o.orderCode} ${money(o.totalAmount)}`).join('\n')+`\nTổng: ${money(h.total)}`)}}}
const statuses={NEW:'Mới',CONFIRMED:'Đã chốt',PICKING:'Đang soạn',PACKED:'Đã đóng gói',SHIPPED:'Đã giao',COMPLETED:'Hoàn tất',CANCELLED:'Đã hủy'};
function statusSelect(o){return `<select data-id="${o.id}">${Object.entries(statuses).map(([k,v])=>`<option value="${k}" ${o.status===k?'selected':''}>${v}</option>`).join('')}</select>`}
function orderCard(o){return `<section class="card"><div class="row"><h2>${esc(o.orderCode)}</h2><span>${new Date(o.orderDate).toLocaleString('vi-VN')}</span><span>${statusSelect(o)}</span></div><div class="grid"><div class="field"><b>KHÁCH HÀNG</b>${esc(o.customer?.name)}</div><div class="field"><b>SỐ ĐIỆN THOẠI</b>${esc(o.customer?.phone||'Chưa có')}</div><div class="field"><b>ĐỊA CHỈ</b>${esc(o.customer?.address||'Chưa có')}</div></div>${(o.details||[]).map(d=>`<div class="field"><b>SẢN PHẨM</b>${esc(d.productName)} ${d.color?`· ${esc(d.color)}`:''} · Size ${esc(d.size||'—')} · ${Number(d.weightKg||0).toLocaleString('vi-VN')} kg · SL ${d.quantity}<br>Giá: ${money(d.price)} · Thành tiền: ${money(d.amount)}</div>`).join('')}<h3>Tổng đơn: ${money(o.totalAmount)}</h3></section>`}
async function orders(c) {
    let allOrders = await api('orders');
  c.innerHTML = `<h1 id="ordersTitle">Đơn hàng (${allOrders.length})</h1><section class="card row order-filters"><label>Từ ngày<input id="ordersFrom" type="date"></label><label>Đến ngày<input id="ordersTo" type="date"></label><button id="filterOrders" class="primary">Lọc</button><button id="todayOrders">Hôm nay</button><button id="resetOrders">Tất cả</button></section><div class="tablewrap"><table class="orders-table"><thead><tr><th>Mã đơn / Ngày</th><th>Khách hàng</th><th>Số điện thoại</th><th>Địa chỉ</th><th>Sản phẩm</th><th>Tổng đơn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="orderRows"></tbody></table></div>`;
  const draw = async () => {
    const from = $('#ordersFrom').value;
    const to = $('#ordersTo').value;
    const params = new URLSearchParams();
    if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) params.set('to', new Date(`${to}T00:00:00`).toISOString());
    allOrders = await api(`orders${params.toString() ? `?${params}` : ''}`);
    const shown = allOrders;
    $('#ordersTitle').textContent = `Đơn hàng (${shown.length})`;
    $('#orderRows').innerHTML = shown.map(o => `<tr class="${o.status === 'CANCELLED' ? 'cancelled-order' : ''}"><td><strong>${esc(o.orderCode)}</strong><br>${new Date(o.orderDate).toLocaleString('vi-VN')}</td><td>${esc(o.customer?.name || 'Chưa có')}</td><td>${esc(o.customer?.phone || 'Chưa có')}</td><td>${esc(o.customer?.address || 'Chưa có')}</td><td>${(o.details || []).map(d => `${esc(d.productName)}${d.color ? ` · ${esc(d.color)}` : ''} · Size ${esc(d.size || '—')} · ${Number(d.weightKg || 0).toLocaleString('vi-VN')} kg · SL ${d.quantity}<br>${money(d.price)} / cái · Thành tiền ${money(d.amount)}`).join('<hr>')}</td><td><strong>${money(o.totalAmount)}</strong></td><td>${statusSelect(o)}</td><td><button data-edit="${o.id}">Sửa</button> <button class="danger" data-delete="${o.id}">Xóa</button></td></tr>`).join('') || '<tr><td colspan="8">Không có đơn hàng trong ngày đã chọn</td></tr>';
  };
  await draw();
  $('#filterOrders').onclick = () => draw().catch(error => toast(error.message));
  $('#todayOrders').onclick = () => { $('#ordersFrom').value = ymd; $('#ordersTo').value = ymd; draw().catch(error => toast(error.message)); };
  $('#resetOrders').onclick = () => { $('#ordersFrom').value = ''; $('#ordersTo').value = ''; draw().catch(error => toast(error.message)); };
  c.onchange = async e => {
    if (!e.target.dataset.id) return;
    try {
      await api(`orders/${e.target.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
      const updated = allOrders.find(o => String(o.id) === e.target.dataset.id);
      if (updated) updated.status = e.target.value;
      await draw();
      toast('Đã cập nhật trạng thái');
    } catch (error) { toast(error.message); }
  };
  c.onclick = async e => {
    const id = e.target.dataset.edit || e.target.dataset.delete;
    if (!id) return;
    const order = allOrders.find(o => String(o.id) === id);
    if (!order) return;
    if (e.target.dataset.delete) {
      if (!confirm(`Xóa đơn ${order.orderCode}? Thao tác này không thể hoàn tác.`)) return;
      try {
        await api(`orders/${id}`, { method: 'DELETE' });
        allOrders.splice(allOrders.indexOf(order), 1);
        await draw();
        toast('Đã xóa đơn hàng');
      } catch (error) { toast(error.message); }
      return;
    }
    editOrder(order);
  };
}
function editOrder(order) {
  const dialog = $('#modal');
  const lines = (order.details || []).map((d, i) => `<fieldset class="order-edit-line"><legend>Sản phẩm ${i + 1}</legend><input type="hidden" name="productId${i}" value="${d.productId ?? ''}"><label>Tên sản phẩm<input name="productName${i}" value="${esc(d.productName)}" required></label><div class="grid"><label>Màu<input name="color${i}" value="${esc(d.color)}"></label><label>Size<input name="size${i}" value="${esc(d.size)}"></label><label>Số lượng<input name="quantity${i}" type="number" min="1" value="${d.quantity}" required></label><label>Số kg<input name="weightKg${i}" type="number" min="0" step="0.001" value="${d.weightKg}" required></label><label>Giá<input name="price${i}" type="number" min="0" step="1" value="${d.price}" required></label></div></fieldset>`).join('');
  dialog.innerHTML = `<h2>Sửa đơn ${esc(order.orderCode)}</h2><form id="editOrderForm"><label>Tên khách hàng<input name="customerName" value="${esc(order.customer?.name)}" required></label><div class="grid"><label>Số điện thoại<input name="phone" value="${esc(order.customer?.phone)}"></label><label>Địa chỉ<input name="address" value="${esc(order.customer?.address)}"></label></div>${lines}<button class="primary">Lưu thay đổi</button> <button type="button" id="closeOrderEdit">Đóng</button></form>`;
  dialog.showModal();
  $('#closeOrderEdit').onclick = () => dialog.close();
  $('#editOrderForm').onsubmit = async e => {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const items = (order.details || []).map((d, i) => ({
      productId: values.get(`productId${i}`) ? Number(values.get(`productId${i}`)) : null,
      productName: values.get(`productName${i}`).trim(), color: values.get(`color${i}`) || null,
      size: values.get(`size${i}`) || null, quantity: Number(values.get(`quantity${i}`)),
      weightKg: Number(values.get(`weightKg${i}`)), price: Number(values.get(`price${i}`))
    }));
    try {
      await api(`orders/${order.id}`, { method: 'PUT', body: JSON.stringify({ customerId: order.customerId, customerName: values.get('customerName').trim(), phone: values.get('phone') || null, address: values.get('address') || null, items }) });
      dialog.close();
      toast('Đã cập nhật đơn hàng');
      render('orders');
    } catch (error) { toast(error.message); }
  };
}async function picking(c){let [a,individual]=await Promise.all([api('orders/picking-summary?date='+ymd),api('orders?from='+encodeURIComponent(ymd)+'&to='+encodeURIComponent(ymd))]);let key=x=>`${x.productName}|${x.color}|${x.size}`;let saved=JSON.parse(localStorage.getItem('picked')||'{}');c.innerHTML=`<h1>📦 Tổng hợp soạn hàng</h1><section class="card"><h2>Tổng hợp sản phẩm cần soạn</h2><button id="all">Đánh dấu tất cả đã soạn</button><div id="list">${a.map(x=>`<label class="checkline"><input type="checkbox" data-k="${esc(key(x))}" ${saved[key(x)]?'checked':''}>${esc(x.productName)} ${x.color?`· ${esc(x.color)}`:''} · Size ${esc(x.size||'—')} <b>${x.quantity} cái · ${Number(x.weightKg||0).toLocaleString('vi-VN')} kg</b></label>`).join('')||'Chưa có đơn hôm nay'}</div><h3>Tổng: ${a.reduce((s,x)=>s+x.quantity,0)} cái · ${a.reduce((s,x)=>s+Number(x.weightKg||0),0).toLocaleString('vi-VN')} kg</h3></section><h2>Đơn hàng riêng lẻ trong ngày (${individual.length})</h2>${individual.map(orderCard).join('')||'<section class="card">Chưa có đơn hôm nay</section>'}`;$('#list').onchange=e=>{if(!e.target.dataset.k)return;saved[e.target.dataset.k]=e.target.checked;localStorage.setItem('picked',JSON.stringify(saved))};$('#all').onclick=()=>{a.forEach(x=>saved[key(x)]=true);localStorage.setItem('picked',JSON.stringify(saved));render('picking')};c.onchange=async e=>{if(e.target.dataset.id)try{await api(`orders/${e.target.dataset.id}/status`,{method:'PATCH',body:JSON.stringify({status:e.target.value})});toast('Đã cập nhật trạng thái')}catch(x){toast(x.message)}}}async function reports(c){let [o,customers]=await Promise.all([api('orders'),api('customers')]),today=new Date().toISOString().slice(0,10),tod=o.filter(x=>x.orderDate.slice(0,10)===today&&x.status!=='CANCELLED'),sum=tod.reduce((s,x)=>s+x.totalAmount,0);let sold={};o.forEach(x=>x.details.forEach(d=>{let k=`${d.productName} size ${d.size}`;sold[k]=(sold[k]||0)+d.quantity}));c.innerHTML=`<h1>Báo cáo</h1><div class="grid"><section class="card">Đơn hôm nay<div class="metric">${tod.length}</div></section><section class="card">Doanh thu hôm nay<div class="metric">${money(sum)}</div></section></div><section class="card"><h2>Sản phẩm bán ra</h2>${Object.entries(sold).map(([k,v])=>`<p>${esc(k)} — ${v}</p>`).join('')}<button id="csv">Xuất danh sách đơn (CSV)</button></section>`;$('#csv').onclick=()=>{let rows=[['Mã','Khách','Tổng','Trạng thái'],...o.map(x=>[x.orderCode,x.customer?.name,x.totalAmount,x.status])],blob=new Blob(['\ufeff'+rows.map(r=>r.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='don-hang.csv';a.click()}}
function password(c){c.innerHTML=`<h1>Đổi mật khẩu</h1><section class="card"><form id="pw"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" required></label><label>Mật khẩu mới (tối thiểu 10 ký tự)<input name="newPassword" type="password" minlength="10" required></label><button>Đổi mật khẩu</button></form></section>`;$('#pw').onsubmit=async e=>{e.preventDefault();try{await api('auth/change-password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});toast('Đã đổi mật khẩu')}catch(x){toast(x.message)}}}init();



