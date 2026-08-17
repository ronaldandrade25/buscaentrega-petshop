// ===============================
// MOTORISTA.JS
// Página separada do motorista
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    updateDoc,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ========= Firebase ========= */
const firebaseConfig = {
    apiKey: "", // COLOQUE_SUA_API_KEY_AQUI
    authDomain: "", // COLOQUE_SEU_AUTH_DOMAIN_AQUI
    projectId: "", // COLOQUE_SEU_PROJECT_ID_AQUI
    storageBucket: "", // COLOQUE_SEU_STORAGE_BUCKET_AQUI
    messagingSenderId: "", // COLOQUE_SEU_MESSAGING_SENDER_ID_AQUI
    appId: "" // COLOQUE_SEU_APP_ID_AQUI
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ========= Constantes ========= */
const BUSCA_ENTREGA_COLLECTION = "busca_entrega";

/* ========= Estado ========= */
const state = {
    items: [],
    filteredItems: [],
    selectedItem: null
};

/* ========= Elementos ========= */
const els = {
    todayLabel: document.getElementById("driverTodayLabel"),

    filters: {
        data: document.getElementById("motData"),
        status: document.getElementById("motStatus"),
        busca: document.getElementById("motBusca"),
        filtrarBtn: document.getElementById("motFiltrarBtn"),
        limparBtn: document.getElementById("motLimparBtn"),
        atualizarBtn: document.getElementById("motAtualizarBtn")
    },

    kpis: {
        total: document.getElementById("kpiTotalRotas"),
        pendentes: document.getElementById("kpiPendentes"),
        noLocal: document.getElementById("kpiNoLocal"),
        entregues: document.getElementById("kpiEntregues")
    },

    agendaGrid: document.getElementById("motoristaAgendaGrid"),
    lista: document.getElementById("motoristaLista"),

    modal: {
        root: document.getElementById("mainModal"),
        title: document.getElementById("modalTitle"),
        body: document.getElementById("modalBody"),
        footer: document.getElementById("modalFooter"),
        close: document.getElementById("modalClose")
    }
};

/* ========= Helpers ========= */
function pad2(n) {
    return String(n).padStart(2, "0");
}

function todayYmd() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateLabel(ymd) {
    if (!ymd) return "-";
    const [y, m, d] = String(ymd).split("-");
    if (!y || !m || !d) return ymd;
    return `${d}/${m}/${y}`;
}

function formatDateTime(dateValue, timeValue) {
    const date = formatDateLabel(dateValue || "");
    const time = (timeValue || "").slice(0, 5);

    if (date === "-" && !time) return "-";
    if (date !== "-" && time) return `${date} ${time}`;
    if (date !== "-") return date;
    return time || "-";
}

function normalizeText(value = "") {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function onlyDigits(value = "") {
    return String(value).replace(/\D+/g, "");
}

function maskPhone(value = "") {
    const digits = onlyDigits(value).slice(0, 11);

    if (digits.length <= 10) {
        return digits.replace(/^(\d{2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => {
            let out = "";
            if (a) out += `(${a}`;
            if (a && a.length === 2) out += ") ";
            if (b) out += b;
            if (c) out += `-${c}`;
            return out;
        });
    }

    return digits.replace(/^(\d{2})(\d{0,5})(\d{0,4}).*/, (_, a, b, c) => {
        let out = "";
        if (a) out += `(${a}`;
        if (a && a.length === 2) out += ") ";
        if (b) out += b;
        if (c) out += `-${c}`;
        return out;
    });
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function statusLabel(status) {
    const map = {
        busca: "Busca",
        "no-local": "No local",
        "saiu-para-entrega": "Saiu para entrega",
        entregue: "Entregue"
    };
    return map[status] || status || "-";
}

function statusClass(status) {
    return `motorista-status-badge motorista-status-${status || "busca"}`;
}

function nextStatus(current) {
    if (current === "busca") return "no-local";
    if (current === "no-local") return "saiu-para-entrega";
    if (current === "saiu-para-entrega") return "entregue";
    return "entregue";
}

function isFromHotelzinho(item = {}) {
    return String(item.origemCadastro || "").startsWith("hotelzinho:");
}

function sourceBadge(item = {}) {
    if (!isFromHotelzinho(item)) return "";
    return `
        <div style="margin-top:4px;">
            <small style="
                display:inline-block;
                padding:4px 8px;
                border-radius:999px;
                background:rgba(243,154,61,.12);
                color:#b56a17;
                font-weight:700;
            ">Hotelzinho</small>
        </div>
    `;
}

function sortItems(items = []) {
    return [...items].sort((a, b) => {
        const aKey = `${a.dataBusca || ""}|${a.horaBusca || ""}|${a.nome || ""}`;
        const bKey = `${b.dataBusca || ""}|${b.horaBusca || ""}|${b.nome || ""}`;
        return aKey.localeCompare(bKey);
    });
}

function mapDoc(docSnap) {
    const data = docSnap.data() || {};
    return {
        id: docSnap.id,
        nome: data.nome || "",
        endereco: data.endereco || "",
        contato: data.contato || "",
        contatoFormatado: data.contatoFormatado || maskPhone(data.contato || ""),
        dataBusca: data.dataBusca || "",
        horaBusca: data.horaBusca || "",
        dataEntrega: data.dataEntrega || "",
        horaEntrega: data.horaEntrega || "",
        status: data.status || "busca",
        obs: data.obs || "",
        motoristaId: data.motoristaId ?? null,
        ordemRota: data.ordemRota ?? null,
        origemCadastro: data.origemCadastro || "admin",
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
    };
}

/* ========= Modal ========= */
function openModal({ title = "", body = "", buttons = [] }) {
    if (!els.modal.root) return;

    els.modal.title.innerHTML = title;
    els.modal.body.innerHTML = body;
    els.modal.footer.innerHTML = "";

    buttons.forEach(btnDef => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = btnDef.className || "btn btn-light";
        btn.innerHTML = btnDef.text || "OK";

        btn.addEventListener("click", async () => {
            if (btnDef.onClick) {
                const keepOpen = await btnDef.onClick();
                if (keepOpen === false) return;
            }
            if (!btnDef.keepOpen) closeModal();
        });

        els.modal.footer.appendChild(btn);
    });

    els.modal.root.classList.remove("hidden");
}

function closeModal() {
    els.modal.root?.classList.add("hidden");
}

function bindModalEvents() {
    els.modal.close?.addEventListener("click", closeModal);

    els.modal.root?.addEventListener("click", (e) => {
        if (e.target === els.modal.root) closeModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && els.modal.root && !els.modal.root.classList.contains("hidden")) {
            closeModal();
        }
    });
}

/* ========= Firebase ========= */
function buildFirestoreQuery() {
    const ref = collection(db, BUSCA_ENTREGA_COLLECTION);
    const constraints = [];

    const data = els.filters.data?.value || "";
    const status = els.filters.status?.value || "";

    if (data) constraints.push(where("dataBusca", "==", data));
    if (status) constraints.push(where("status", "==", status));

    if (!constraints.length) return ref;
    return query(ref, ...constraints);
}

async function loadItems() {
    try {
        renderLoading();

        const qy = buildFirestoreQuery();
        const snap = await getDocs(qy);

        let items = snap.docs.map(mapDoc);
        items = sortItems(items);

        const busca = normalizeText(els.filters.busca?.value || "");
        if (busca) {
            items = items.filter(item => {
                const text = normalizeText(
                    `${item.nome} ${item.endereco} ${item.contatoFormatado || item.contato} ${item.obs}`
                );
                return text.includes(busca);
            });
        }

        state.items = items;
        state.filteredItems = items;

        renderKpis(items);
        renderAgenda(items);
        renderList(items);
    } catch (error) {
        console.error("Erro ao carregar agenda do motorista:", error);
        renderEmpty("Não foi possível carregar a agenda do motorista.");
    }
}

async function updateRoute(id, payload) {
    await updateDoc(doc(db, BUSCA_ENTREGA_COLLECTION, id), {
        ...payload,
        updatedAt: serverTimestamp()
    });
}

async function updateRouteStatus(id, status) {
    await updateDoc(doc(db, BUSCA_ENTREGA_COLLECTION, id), {
        status,
        updatedAt: serverTimestamp()
    });
}

/* ========= Render ========= */
function renderLoading() {
    if (els.agendaGrid) {
        els.agendaGrid.innerHTML = `
            <div class="motorista-empty-card">
                <i class="bx bx-loader-alt bx-spin"></i>
                <span>Carregando agenda...</span>
            </div>
        `;
    }

    if (els.lista) {
        els.lista.innerHTML = `
            <div class="motorista-empty-list">
                <i class="bx bx-loader-alt bx-spin"></i>
                <span>Carregando rotas...</span>
            </div>
        `;
    }
}

function renderEmpty(message = "Nenhuma rota encontrada.") {
    if (els.agendaGrid) {
        els.agendaGrid.innerHTML = `
            <div class="motorista-empty-card">
                <i class="bx bx-info-circle"></i>
                <span>${escapeHtml(message)}</span>
            </div>
        `;
    }

    if (els.lista) {
        els.lista.innerHTML = `
            <div class="motorista-empty-list">
                <i class="bx bx-info-circle"></i>
                <span>${escapeHtml(message)}</span>
            </div>
        `;
    }

    renderKpis([]);
}

function renderKpis(items = []) {
    const pendentes = items.filter(item => item.status === "busca").length;
    const noLocal = items.filter(item => item.status === "no-local").length;
    const entregues = items.filter(item => item.status === "entregue").length;

    if (els.kpis.total) els.kpis.total.textContent = String(items.length);
    if (els.kpis.pendentes) els.kpis.pendentes.textContent = String(pendentes);
    if (els.kpis.noLocal) els.kpis.noLocal.textContent = String(noLocal);
    if (els.kpis.entregues) els.kpis.entregues.textContent = String(entregues);
}

function renderAgenda(items = []) {
    if (!els.agendaGrid) return;

    if (!items.length) {
        els.agendaGrid.innerHTML = `
            <div class="motorista-empty-card">
                <i class="bx bx-calendar-x"></i>
                <span>Nenhuma rota encontrada para os filtros informados.</span>
            </div>
        `;
        return;
    }

    els.agendaGrid.innerHTML = items.map(item => `
        <article class="motorista-slot" data-id="${item.id}">
            <div class="motorista-slot-header">
                <div>
                    <div class="motorista-slot-time">${escapeHtml((item.horaBusca || "--:--").slice(0, 5))}</div>
                    <div class="motorista-slot-date">${escapeHtml(formatDateLabel(item.dataBusca))}</div>
                </div>
                <span class="${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
            </div>

            <div class="motorista-slot-body">
                <div class="motorista-slot-client">${escapeHtml(item.nome || "-")}</div>
                ${sourceBadge(item)}
                <div class="motorista-slot-contact">${escapeHtml(item.contatoFormatado || item.contato || "-")}</div>
                <div class="motorista-slot-address">${escapeHtml(item.endereco || "-")}</div>
            </div>

            <div class="motorista-slot-actions">
                <button class="btn btn-light btn-sm" type="button" data-action="details" data-id="${item.id}">
                    <i class="bx bx-show"></i>
                    Ver detalhes
                </button>
                <button class="btn btn-primary btn-sm" type="button" data-action="advance" data-id="${item.id}">
                    <i class="bx bx-check"></i>
                    Confirmar etapa
                </button>
            </div>
        </article>
    `).join("");
}

function renderList(items = []) {
    if (!els.lista) return;

    if (!items.length) {
        els.lista.innerHTML = `
            <div class="motorista-empty-list">
                <i class="bx bx-list-ul"></i>
                <span>Nenhuma rota encontrada para os filtros informados.</span>
            </div>
        `;
        return;
    }

    els.lista.innerHTML = items.map(item => `
        <article class="driver-route-item" data-id="${item.id}">
            <div class="driver-route-item-top">
                <div>
                    <div class="driver-route-item-name">${escapeHtml(item.nome || "-")}</div>
                    ${sourceBadge(item)}
                </div>
                <span class="${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
            </div>

            <div class="driver-route-item-meta">
                <div><strong>Busca:</strong> ${escapeHtml(formatDateTime(item.dataBusca, item.horaBusca))}</div>
                <div><strong>Entrega:</strong> ${escapeHtml(formatDateTime(item.dataEntrega, item.horaEntrega))}</div>
                <div><strong>Contato:</strong> ${escapeHtml(item.contatoFormatado || item.contato || "-")}</div>
            </div>

            <div class="driver-route-item-actions">
                <button class="btn btn-light btn-sm" type="button" data-action="details" data-id="${item.id}">
                    <i class="bx bx-edit-alt"></i>
                    Abrir
                </button>
                <button class="btn btn-success btn-sm" type="button" data-action="delivered" data-id="${item.id}">
                    <i class="bx bx-check-double"></i>
                    Entregue
                </button>
            </div>
        </article>
    `).join("");
}

/* ========= Modal de detalhes ========= */
function openDetailsModal(item) {
    if (!item) return;

    state.selectedItem = item;

    const statuses = [
        { value: "busca", label: "Busca" },
        { value: "no-local", label: "No local" },
        { value: "saiu-para-entrega", label: "Saiu para entrega" },
        { value: "entregue", label: "Entregue" }
    ];

    const statusOptions = statuses.map(opt => `
        <option value="${opt.value}" ${item.status === opt.value ? "selected" : ""}>${opt.label}</option>
    `).join("");

    openModal({
        title: `Cliente • ${escapeHtml(item.nome || "Rota")}`,
        body: `
            <div class="form-grid">
                <div class="field">
                    <label for="modalNome">Cliente</label>
                    <input id="modalNome" type="text" value="${escapeHtml(item.nome || "")}" />
                </div>

                <div class="field">
                    <label for="modalContato">Contato</label>
                    <input id="modalContato" type="text" value="${escapeHtml(item.contatoFormatado || item.contato || "")}" />
                </div>

                <div class="field" style="grid-column: 1 / -1;">
                    <label for="modalEndereco">Endereço</label>
                    <input id="modalEndereco" type="text" value="${escapeHtml(item.endereco || "")}" />
                </div>

                <div class="field">
                    <label for="modalDataBusca">Data da busca</label>
                    <input id="modalDataBusca" type="date" value="${escapeHtml(item.dataBusca || "")}" />
                </div>

                <div class="field">
                    <label for="modalHoraBusca">Horário da busca</label>
                    <input id="modalHoraBusca" type="time" value="${escapeHtml(item.horaBusca || "")}" />
                </div>

                <div class="field">
                    <label for="modalDataEntrega">Data da entrega</label>
                    <input id="modalDataEntrega" type="date" value="${escapeHtml(item.dataEntrega || "")}" />
                </div>

                <div class="field">
                    <label for="modalHoraEntrega">Horário da entrega</label>
                    <input id="modalHoraEntrega" type="time" value="${escapeHtml(item.horaEntrega || "")}" />
                </div>

                <div class="field">
                    <label for="modalStatus">Status</label>
                    <select id="modalStatus">${statusOptions}</select>
                </div>

                <div class="field" style="grid-column: 1 / -1;">
                    <label for="modalObs">Observações</label>
                    <textarea id="modalObs">${escapeHtml(item.obs || "")}</textarea>
                </div>
            </div>
        `,
        buttons: [
            {
                text: '<i class="bx bx-save"></i> Salvar alterações',
                className: "btn btn-primary",
                onClick: async () => {
                    const payload = {
                        nome: document.getElementById("modalNome")?.value.trim() || "",
                        endereco: document.getElementById("modalEndereco")?.value.trim() || "",
                        contato: onlyDigits(document.getElementById("modalContato")?.value || ""),
                        contatoFormatado: maskPhone(document.getElementById("modalContato")?.value || ""),
                        dataBusca: document.getElementById("modalDataBusca")?.value || "",
                        horaBusca: document.getElementById("modalHoraBusca")?.value || "",
                        dataEntrega: document.getElementById("modalDataEntrega")?.value || "",
                        horaEntrega: document.getElementById("modalHoraEntrega")?.value || "",
                        status: document.getElementById("modalStatus")?.value || "busca",
                        obs: document.getElementById("modalObs")?.value.trim() || "",
                        motoristaId: item.motoristaId ?? null,
                        ordemRota: item.ordemRota ?? null,
                        origemCadastro: item.origemCadastro || "admin"
                    };

                    if (!payload.nome) {
                        alert("Informe o nome do cliente.");
                        return false;
                    }

                    if (!payload.endereco) {
                        alert("Informe o endereço.");
                        return false;
                    }

                    if (!payload.contato) {
                        alert("Informe o contato.");
                        return false;
                    }

                    if (!payload.dataBusca || !payload.horaBusca) {
                        alert("Informe a data e o horário da busca.");
                        return false;
                    }

                    if (!payload.dataEntrega || !payload.horaEntrega) {
                        alert("Informe a data e o horário da entrega.");
                        return false;
                    }

                    const buscaKey = `${payload.dataBusca}T${payload.horaBusca}`;
                    const entregaKey = `${payload.dataEntrega}T${payload.horaEntrega}`;

                    if (entregaKey < buscaKey) {
                        alert("A data/hora da entrega não pode ser menor que a da busca.");
                        return false;
                    }

                    await updateRoute(item.id, payload);
                    await loadItems();
                }
            },
            {
                text: '<i class="bx bx-check"></i> Confirmar etapa',
                className: "btn btn-success",
                onClick: async () => {
                    await updateRouteStatus(item.id, nextStatus(item.status));
                    await loadItems();
                }
            },
            {
                text: '<i class="bx bx-x"></i> Fechar',
                className: "btn btn-light"
            }
        ]
    });

    const modalContato = document.getElementById("modalContato");
    modalContato?.addEventListener("input", () => {
        modalContato.value = maskPhone(modalContato.value);
    });
}

/* ========= Eventos ========= */
async function handleAction(action, id) {
    const item = state.filteredItems.find(x => x.id === id);
    if (!item) return;

    if (action === "details") {
        openDetailsModal(item);
        return;
    }

    if (action === "advance") {
        await updateRouteStatus(id, nextStatus(item.status));
        await loadItems();
        return;
    }

    if (action === "delivered") {
        await updateRouteStatus(id, "entregue");
        await loadItems();
    }
}

function bindGridActions() {
    els.agendaGrid?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;
        await handleAction(action, id);
    });

    els.lista?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;
        await handleAction(action, id);
    });
}

function bindFilters() {
    els.filters.filtrarBtn?.addEventListener("click", loadItems);
    els.filters.atualizarBtn?.addEventListener("click", loadItems);

    els.filters.limparBtn?.addEventListener("click", async () => {
        if (els.filters.data) els.filters.data.value = todayYmd();
        if (els.filters.status) els.filters.status.value = "";
        if (els.filters.busca) els.filters.busca.value = "";
        await loadItems();
    });

    els.filters.data?.addEventListener("change", loadItems);
    els.filters.status?.addEventListener("change", loadItems);
    els.filters.busca?.addEventListener("input", loadItems);
}

/* ========= Init ========= */
function setTodayDefaults() {
    const today = todayYmd();

    if (els.filters.data && !els.filters.data.value) {
        els.filters.data.value = today;
    }

    const now = new Date();
    const dateLabel = now.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

    if (els.todayLabel) {
        els.todayLabel.textContent = dateLabel;
    }
}

async function init() {
    setTodayDefaults();
    bindModalEvents();
    bindFilters();
    bindGridActions();
    await loadItems();
}

document.addEventListener("DOMContentLoaded", init);