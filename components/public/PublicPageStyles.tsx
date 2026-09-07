"use client";

export default function PublicPageStyles() {
  return (
    <style jsx global>{`
      :root {
        --ch-bg: #020b14;
        --ch-bg2: #061422;
        --ch-panel: #081522;
        --ch-line: rgba(255,255,255,.12);
        --ch-muted: #9db2c9;
        --ch-gold: #d8a22f;
        --ch-gold2: #efc55f;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: var(--ch-bg);
      }

      .ch-page {
        min-height: 100vh;
        overflow-x: hidden;
        background:
          radial-gradient(circle at 72% 10%, rgba(216,162,47,.05), transparent 30%),
          var(--ch-bg);
        color: #fff;
        font-family: Arial, Helvetica, sans-serif;
      }

      .ch-page * {
        box-sizing: border-box;
      }

      .ch-page a {
        color: inherit;
        text-decoration: none;
      }

      .ch-section {
        padding: 48px 0;
        background: var(--ch-bg);
        border-bottom: 1px solid rgba(255,255,255,.07);
      }

      .ch-section-soft {
        background: #06111d;
      }

      .ch-section-inner {
        width: min(1300px, calc(100% - 48px));
        margin: 0 auto;
      }

      .ch-kicker {
        margin: 0;
        color: var(--ch-gold2);
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: .06em;
        font-weight: 900;
      }

      .ch-title {
        margin: 7px 0 0;
        max-width: 920px;
        font-size: clamp(28px, 2.2vw, 36px);
        line-height: 1.08;
        letter-spacing: -.025em;
        font-weight: 950;
      }

      .ch-lead {
        max-width: 920px;
        margin: 18px 0 0;
        color: var(--ch-muted);
        font-size: 16px;
        line-height: 1.75;
      }

      .ch-cards {
        display: grid;
        gap: 16px;
        margin-top: 26px;
      }

      .ch-cards-3 {
        grid-template-columns: repeat(3, 1fr);
      }

      .ch-cards-4 {
        grid-template-columns: repeat(4, 1fr);
      }

      .ch-card {
        min-height: 276px;
        display: flex;
        flex-direction: column;
        padding: 22px;
        border: 1px solid var(--ch-line);
        border-radius: 18px;
        background: #071522;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.02);
      }

      .ch-number {
        color: var(--ch-gold2);
        font-size: 11px;
        font-weight: 900;
      }

      .ch-card h2,
      .ch-card h3 {
        margin: 28px 0 0;
        font-size: 20px;
        line-height: 1.2;
        font-weight: 950;
      }

      .ch-card p {
        margin: 16px 0 20px;
        color: var(--ch-muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .ch-split {
        display: grid;
        grid-template-columns: .82fr 1.18fr;
        gap: 38px;
        align-items: start;
      }

      .ch-benefits {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 26px;
      }

      .ch-benefit {
        min-height: 138px;
        display: flex;
        align-items: center;
        padding: 18px;
        border: 1px solid var(--ch-line);
        border-radius: 16px;
        background: #071522;
        font-size: 15px;
        line-height: 1.45;
        font-weight: 850;
      }

      .ch-check {
        margin-right: 10px;
        color: var(--ch-gold2);
      }

      .ch-construction {
        min-height: 420px;
        display: grid;
        place-items: center;
        text-align: center;
      }

      @media (max-width: 1180px) {
        .ch-cards-4,
        .ch-cards-3 {
          grid-template-columns: repeat(2, 1fr);
        }

        .ch-split {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 760px) {
        .ch-section-inner {
          width: min(100% - 28px, 1300px);
        }

        .ch-cards-4,
        .ch-cards-3,
        .ch-benefits {
          grid-template-columns: 1fr;
        }

        .ch-title {
          font-size: 30px;
        }
      }
    `}</style>
  );
}
