"""
Envoi des rapports d'analyse par email (SMTP).

Piloté par variables d'environnement — fonctionne avec n'importe quel fournisseur
SMTP (compte mutualisé, Brevo, Resend, SendGrid…). Pour le grand public, préférer
un service transactionnel (quotas élevés) plutôt qu'un compte mutualisé.
"""
from __future__ import annotations

import os
import smtplib
import ssl
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape

_MOD_META = {
    "media":   ("Vérif-Média", "Manipulation IA", "🎥"),
    "info":    ("Vérif-Info", "Fact-checking & IA", "📰"),
    "link":    ("Vérif-Lien", "Phishing / arnaque", "🔗"),
    "account": ("Vérif-Compte", "Compte officiel", "👤"),
}
_BG     = {"red": "#FCEBEC", "orange": "#FFF8EC", "green": "#EEF3F0", "error": "#f3f4f6"}
_BORDER = {"red": "#C8102E", "orange": "#d97706", "green": "#0A5C42", "error": "#9ca3af"}
_COLOR  = {"red": "#C8102E", "orange": "#b45309", "green": "#0A5C42", "error": "#6b7280"}
_ICON   = {"red": "⚠️", "orange": "⚠️", "green": "✅", "error": "❓"}


def _module_block(mod: str, r: dict | None) -> str:
    title, subtitle, micon = _MOD_META.get(mod, (mod, "", "🔍"))
    r = r or {}
    level = r.get("level", "error")
    bg, border, color = _BG.get(level, "#f3f4f6"), _BORDER.get(level, "#9ca3af"), _COLOR.get(level, "#6b7280")
    icon = _ICON.get(level, "❓")
    badge = escape(str(r.get("badge", "—")))
    label = escape(str(r.get("label", "—")))
    expl = escape(str(r.get("explanation", "")))
    score = r.get("score")
    score_html = (
        f'<span style="float:right;font-size:22px;font-weight:900;color:{color}">{score}%</span>'
        if score is not None else ""
    )
    expl_html = f'<div style="font-size:12px;color:#555;line-height:1.5">{expl}</div>' if expl else ""
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;border:1px solid {border};border-radius:10px;overflow:hidden;background:{bg}">
      <tr><td style="padding:14px 16px;border-bottom:1px solid {border}22">
        <span style="font-size:16px">{micon}</span>
        <strong style="font-size:14px;color:#0A5C42;margin-left:6px">{title}</strong>
        <span style="font-size:11px;color:#83837b;margin-left:6px">· {subtitle}</span>
        <span style="float:right;font-size:13px;font-weight:800;color:{color}">{icon} {badge}</span>
      </td></tr>
      <tr><td style="padding:12px 16px">{score_html}
        <div style="font-size:13px;font-weight:700;color:#11201A;margin-bottom:6px">{label}</div>
        {expl_html}
      </td></tr>
    </table>"""


def build_email_html(url: str, date: str, results: dict) -> str:
    try:
        dt = datetime.fromisoformat(date.replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M")
    except Exception:
        dt = date or ""
    alerts = sum(1 for r in results.values() if r and r.get("level") == "red")
    warnings = sum(1 for r in results.values() if r and r.get("level") == "orange")
    summary_color = "#C8102E" if alerts else ("#d97706" if warnings else "#0A5C42")
    if alerts:
        summary = f"⚠ {alerts} alerte(s) critique(s) détectée(s)"
    elif warnings:
        summary = f"⚠ {warnings} point(s) de vigilance"
    else:
        summary = "✅ Aucune alerte — contenu sûr"

    modules = "".join(_module_block(m, results.get(m)) for m in ("media", "info", "link", "account"))
    safe_url = escape(url[:70] + "…" if len(url) > 70 else url)

    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0efe9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0efe9;padding:24px 0"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden">
  <tr><td style="background:#0A5C42;padding:22px 28px">
    <div style="font-size:24px;font-weight:900;color:#fff">Vig<span style="color:#F2B705">IA</span></div>
    <div style="font-size:12px;color:rgba(255,255,255,.65)">Rapport d'analyse de sécurité numérique</div>
  </td></tr>
  <tr><td style="padding:20px 28px 0;border-bottom:1px solid #eee">
    <div style="font-size:10px;text-transform:uppercase;color:#999">Page analysée · {dt}</div>
    <div style="font-size:12px;word-break:break-all"><a href="{escape(url)}" style="color:#0A5C42">{safe_url}</a></div>
    <div style="height:12px"></div>
  </td></tr>
  <tr><td style="padding:16px 28px;background:#fafaf8;border-bottom:2px solid {summary_color}22">
    <div style="font-size:16px;font-weight:800;color:{summary_color}">{summary}</div>
  </td></tr>
  <tr><td style="padding:20px 28px 24px">
    <div style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:14px">Résultats par module</div>
    {modules}
  </td></tr>
  <tr><td style="padding:14px 28px;background:#f7f6f2;text-align:center;font-size:10px;color:#aaa">
    Rapport généré automatiquement par VigIA · <a href="https://vigia.cm" style="color:#0A5C42">vigia.cm</a>
  </td></tr>
</table></td></tr></table></body></html>"""


def send_report(to: str, url: str, date: str, results: dict) -> None:
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    pwd = os.getenv("SMTP_PASS")
    port = int(os.getenv("SMTP_PORT", "587"))
    name = os.getenv("SMTP_NAME", "VigIA")

    if not (host and user and pwd):
        raise RuntimeError("SMTP non configuré (SMTP_HOST / SMTP_USER / SMTP_PASS)")

    html = build_email_html(url or "", date or datetime.utcnow().isoformat(), results or {})

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "VigIA — Rapport d'analyse"
    msg["From"] = f"{name} <{user}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    with smtplib.SMTP(host, port, timeout=15) as server:
        server.starttls(context=context)
        server.login(user, pwd)
        server.sendmail(user, [to], msg.as_string())
