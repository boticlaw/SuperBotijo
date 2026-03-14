import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider, useI18n } from "@/i18n/provider";

function Probe() {
  const { t, setLocale } = useI18n();

  return (
    <div>
      <p data-testid="loading-key">{t("dashboard.telemetry.loading")}</p>
      <button type="button" onClick={() => setLocale("es")}>
        switch-es
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        switch-en
      </button>
    </div>
  );
}

describe("I18nProvider telemetry keys", () => {
  it("renders telemetry messages in english and spanish at runtime", () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId("loading-key")).toHaveTextContent("Loading real telemetry...");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "switch-es" }));
    });

    expect(screen.getByTestId("loading-key").textContent).toContain("Cargando telemet");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "switch-en" }));
    });

    expect(screen.getByTestId("loading-key")).toHaveTextContent("Loading real telemetry...");
  });
});
