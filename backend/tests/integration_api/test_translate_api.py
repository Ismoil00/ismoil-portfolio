"""POST /admin/translate — admin only; works through whatever translator the app was given."""

from tests.unit.test_translation_service import FakeTranslator

URL = "/api/v1/admin/translate"


async def test_requires_a_session(client):
    assert (await client.post(URL, json={"text": "Hello", "format": "text"})).status_code == 401


async def test_translates_with_the_configured_translator(app, auth_client):
    app.state.translator = FakeTranslator({"ru": "Привет", "tg": "Салом"})
    response = await auth_client.post(URL, json={"text": "Hello", "format": "text"})
    assert response.status_code == 200, response.text
    assert response.json() == {"ru": "Привет", "tg": "Салом"}


async def test_explains_when_translation_is_not_set_up(app, auth_client):
    app.state.translator = None
    response = await auth_client.post(URL, json={"text": "Hello", "format": "text"})
    assert response.status_code == 503
    assert "ANTHROPIC_API_KEY" in response.json()["detail"]


async def test_validates_input(app, auth_client):
    app.state.translator = FakeTranslator()
    assert (await auth_client.post(URL, json={"text": "", "format": "text"})).status_code == 422
    assert (await auth_client.post(URL, json={"text": "Hi", "format": "pdf"})).status_code == 422
    assert (await auth_client.post(URL, json={"text": "x" * 60_001, "format": "text"})).status_code == 422
