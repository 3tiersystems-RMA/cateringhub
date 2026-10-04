/** Client-safe PayFast form submit helper (no server credentials). */

export type PayFastFormField = { name: string; value: string };

export function submitPayFastForm(gatewayUrl: string, fields: PayFastFormField[]) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = gatewayUrl;

  for (const { name, value } of fields) {
    if (!name || value === undefined || value === null || String(value).trim() === '') continue;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
