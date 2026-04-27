/**
 * 이카운트 Open API 클라이언트
 * 인증 흐름: Zone 조회 → 로그인(SESSION_ID) → API 호출
 * 참조: https://sboapi.ecount.com/ECERP/OAPI/OAPIView
 */

import * as storage from './storage.js';

const ZONE_URL = 'https://sboapi.ecount.com/OAPI/V2/Zone';

class EcountAPI {
  constructor() {
    this.sessionId = null;
    this.zone = null;      // Zone 코드 (예: "CC")
    this.baseUrl = null;    // 예: "https://sboapiCC.ecount.com"
  }

  // ── 인증 ──

  /** Zone 조회 → Zone 코드 + baseUrl 설정 */
  async getZone(comCode) {
    const res = await fetch(ZONE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ COM_CODE: comCode }),
    });
    const data = await res.json();
    const status = String(data.Status);
    if (status !== '200') {
      throw new Error(`Zone 조회 실패: ${data.Error?.Message || JSON.stringify(data).slice(0, 200)}`);
    }
    const dataObj = data.Data?.Datas || data.Data || {};
    this.zone = dataObj.ZONE || dataObj.Zone || dataObj.zone || data.Data?.ZONE || data.Data?.Zone;
    if (!this.zone) {
      throw new Error(`Zone 값을 찾을 수 없습니다. 응답: ${JSON.stringify(data.Data).slice(0, 300)}`);
    }
    this.baseUrl = `https://sboapi${this.zone}.ecount.com`;
    return this.zone;
  }

  /** 로그인 → SESSION_ID 발급 */
  async login(comCode, userId, apiCertKey) {
    if (!this.zone) {
      await this.getZone(comCode);
    }
    const res = await fetch(`${this.baseUrl}/OAPI/V2/OAPILogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        COM_CODE: comCode,
        USER_ID: userId,
        API_CERT_KEY: apiCertKey,
        LAN_TYPE: 'ko-KR',
        ZONE: this.zone,
      }),
    });
    const data = await res.json();
    const status = String(data.Status);
    if (status !== '200') {
      throw new Error(`로그인 실패: ${data.Error?.Message || JSON.stringify(data).slice(0, 200)}`);
    }
    const loginObj = data.Data?.Datas || data.Data || {};
    this.sessionId = loginObj.SESSION_ID || loginObj.session_id;
    if (!this.sessionId) {
      throw new Error(`SESSION_ID 없음. 응답: ${JSON.stringify(data.Data).slice(0, 300)}`);
    }
    await storage.saveSession(this.sessionId, this.baseUrl);
    return this.sessionId;
  }

  /** 세션 복원 또는 재로그인 */
  async ensureSession() {
    const saved = await storage.getSession();
    if (saved) {
      this.sessionId = saved.sessionId;
      this.baseUrl = saved.baseUrl || saved.zoneUrl;
      return;
    }
    const creds = await storage.getCredentials();
    if (!creds) throw new Error('인증 정보가 설정되지 않았습니다');
    await this.login(creds.comCode, creds.userId, creds.apiCertKey);
  }

  /** API 요청 공통 */
  async request(method, path, body = null) {
    await this.ensureSession();
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'SESSION_ID': this.sessionId,
      },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json();

    // 세션 만료 시 재로그인 후 재시도
    if (String(data.Status) === '401' || data.Error?.Code === 'SESSION_EXPIRED') {
      await storage.remove(storage.KEYS.ECOUNT_SESSION);
      this.sessionId = null;
      await this.ensureSession();
      options.headers['SESSION_ID'] = this.sessionId;
      const retryUrl = `${this.baseUrl}${path}`;
      const retry = await fetch(retryUrl, options);
      return retry.json();
    }
    return data;
  }

  // ── 판매 (Sales) ──

  /** 판매전표 등록 */
  async createSaleSlip(slipData) {
    return this.request('POST', '/OAPI/V2/Sale/SaveSale', slipData);
  }

  /** 판매전표 조회 */
  async getSaleSlips(params) {
    return this.request('POST', '/OAPI/V2/Sale/GetSaleList', params);
  }

  /** 판매전표 상세 조회 */
  async getSaleSlipDetail(params) {
    return this.request('POST', '/OAPI/V2/Sale/GetSaleInfo', params);
  }

  /** 판매전표 수정 */
  async updateSaleSlip(slipData) {
    return this.request('POST', '/OAPI/V2/Sale/UpdateSale', slipData);
  }

  /** 판매전표 삭제 */
  async deleteSaleSlip(params) {
    return this.request('POST', '/OAPI/V2/Sale/DeleteSale', params);
  }

  // ── 구매 (Purchase) ──

  /** 구매전표 등록 */
  async createPurchaseSlip(slipData) {
    return this.request('POST', '/OAPI/V2/Purchase/SavePurchase', slipData);
  }

  /** 구매전표 조회 */
  async getPurchaseSlips(params) {
    return this.request('POST', '/OAPI/V2/Purchase/GetPurchaseList', params);
  }

  /** 구매전표 상세 */
  async getPurchaseSlipDetail(params) {
    return this.request('POST', '/OAPI/V2/Purchase/GetPurchaseInfo', params);
  }

  // ── 재고 (Inventory) ──

  /** 재고 현황 조회 */
  async getInventory(params) {
    return this.request('POST', '/OAPI/V2/Inventory/GetInventoryList', params);
  }

  /** 재고 조정 */
  async adjustInventory(data) {
    return this.request('POST', '/OAPI/V2/Inventory/SaveInventoryAdjust', data);
  }

  // ── 제품 (Product) ──

  /** 제품 목록 조회 */
  async getProducts(params) {
    return this.request('POST', '/OAPI/V2/Product/GetProductList', params);
  }

  /** 제품 상세 조회 */
  async getProductDetail(params) {
    return this.request('POST', '/OAPI/V2/Product/GetProductInfo', params);
  }

  // ── 거래처 (Account) ──

  /** 거래처 목록 조회 */
  async getAccounts(params) {
    return this.request('POST', '/OAPI/V2/Account/GetAccountList', params);
  }

  /** 거래처 등록 */
  async createAccount(data) {
    return this.request('POST', '/OAPI/V2/Account/SaveAccount', data);
  }

  // ── 입금 (Deposit) ──

  /** 입금 등록 */
  async createDeposit(data) {
    return this.request('POST', '/OAPI/V2/Sale/SaveDeposit', data);
  }

  /** 입금 목록 조회 */
  async getDeposits(params) {
    return this.request('POST', '/OAPI/V2/Sale/GetDepositList', params);
  }

  // ── 유틸리티 ──

  /** 연결 테스트 */
  async testConnection() {
    try {
      await this.ensureSession();
      return { success: true, sessionId: this.sessionId, zone: this.zone, baseUrl: this.baseUrl };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /** 날짜 포맷 (이카운트: YYYYMMDD) */
  static formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  }

  /** 금액 포맷 */
  static formatAmount(amount) {
    return Math.round(Number(amount) || 0);
  }
}

export default EcountAPI;
