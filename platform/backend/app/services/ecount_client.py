"""이카운트 Open API Python 클라이언트"""

import httpx
from datetime import datetime, timedelta

ZONE_URL = "https://sboapi.ecount.com/OAPI/V2/Zone"


class EcountClient:
    def __init__(self, com_code: str, user_id: str, api_cert_key: str):
        self.com_code = com_code
        self.user_id = user_id
        self.api_cert_key = api_cert_key
        self.zone: str | None = None
        self.base_url: str | None = None
        self.session_id: str | None = None
        self.session_expires: datetime | None = None
        self._client = httpx.AsyncClient(timeout=30.0)

    async def get_zone(self) -> str:
        res = await self._client.post(ZONE_URL, json={"COM_CODE": self.com_code})
        data = res.json()
        status = str(data.get("Status", ""))
        if status != "200":
            raise Exception(f"Zone 조회 실패: {data.get('Error', {}).get('Message', str(data)[:200])}")
        data_obj = data.get("Data", {})
        datas = data_obj.get("Datas", data_obj) if isinstance(data_obj, dict) else {}
        self.zone = datas.get("ZONE") or datas.get("Zone") or datas.get("zone") or data_obj.get("ZONE") or data_obj.get("Zone")
        if not self.zone:
            raise Exception(f"Zone 값을 찾을 수 없습니다. 응답: {str(data.get('Data'))[:300]}")
        self.base_url = f"https://sboapi{self.zone}.ecount.com"
        return self.zone

    async def login(self) -> str:
        if not self.zone:
            await self.get_zone()
        res = await self._client.post(f"{self.base_url}/OAPI/V2/OAPILogin", json={
            "COM_CODE": self.com_code,
            "USER_ID": self.user_id,
            "API_CERT_KEY": self.api_cert_key,
            "LAN_TYPE": "ko-KR",
            "ZONE": self.zone,
        })
        data = res.json()
        status = str(data.get("Status", ""))
        if status != "200":
            raise Exception(f"로그인 실패: {data.get('Error', {}).get('Message', str(data)[:200])}")
        login_obj = data.get("Data", {}).get("Datas", data.get("Data", {}))
        self.session_id = login_obj.get("SESSION_ID") or login_obj.get("session_id")
        if not self.session_id:
            raise Exception(f"SESSION_ID 없음. 응답: {str(data.get('Data'))[:300]}")
        self.session_expires = datetime.utcnow() + timedelta(hours=24)
        return self.session_id

    async def ensure_session(self):
        if self.session_id and self.session_expires and datetime.utcnow() < self.session_expires:
            return
        await self.login()

    async def request(self, path: str, body: dict | None = None) -> dict:
        await self.ensure_session()
        res = await self._client.post(
            f"{self.base_url}{path}",
            json=body or {},
            headers={"SESSION_ID": self.session_id},
        )
        data = res.json()
        if str(data.get("Status", "")) == "401":
            self.session_id = None
            await self.ensure_session()
            res = await self._client.post(
                f"{self.base_url}{path}",
                json=body or {},
                headers={"SESSION_ID": self.session_id},
            )
            data = res.json()
        return data

    # ── 판매 ──
    async def create_sale(self, sale_list: list[dict]) -> dict:
        return await self.request("/OAPI/V2/Sale/SaveSale", {"SaleList": sale_list})

    async def get_sales(self, from_date: str, to_date: str, **kwargs) -> dict:
        return await self.request("/OAPI/V2/Sale/GetSaleList", {"FROM_DATE": from_date, "TO_DATE": to_date, **kwargs})

    async def get_sale_detail(self, **kwargs) -> dict:
        return await self.request("/OAPI/V2/Sale/GetSaleInfo", kwargs)

    # ── 구매 ──
    async def create_purchase(self, purchase_list: list[dict]) -> dict:
        return await self.request("/OAPI/V2/Purchase/SavePurchase", {"PurchaseList": purchase_list})

    async def get_purchases(self, from_date: str, to_date: str, **kwargs) -> dict:
        return await self.request("/OAPI/V2/Purchase/GetPurchaseList", {"FROM_DATE": from_date, "TO_DATE": to_date, **kwargs})

    # ── 재고 ──
    async def get_inventory(self, **kwargs) -> dict:
        return await self.request("/OAPI/V2/Inventory/GetInventoryList", kwargs)

    # ── 제품 ──
    async def get_products(self, **kwargs) -> dict:
        return await self.request("/OAPI/V2/Product/GetProductList", kwargs)

    async def get_product_detail(self, prod_code: str) -> dict:
        return await self.request("/OAPI/V2/Product/GetProductInfo", {"PROD_CODE": prod_code})

    # ── 거래처 ──
    async def get_accounts(self, **kwargs) -> dict:
        return await self.request("/OAPI/V2/Account/GetAccountList", kwargs)

    # ── 입금 ──
    async def create_deposit(self, deposit_list: list[dict]) -> dict:
        return await self.request("/OAPI/V2/Sale/SaveDeposit", {"DepositList": deposit_list})

    async def get_deposits(self, from_date: str, to_date: str, **kwargs) -> dict:
        return await self.request("/OAPI/V2/Sale/GetDepositList", {"FROM_DATE": from_date, "TO_DATE": to_date, **kwargs})

    # ── 연결 테스트 ──
    async def test_connection(self) -> dict:
        try:
            await self.ensure_session()
            return {"success": True, "zone": self.zone, "base_url": self.base_url, "session_id": self.session_id}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def close(self):
        await self._client.aclose()
