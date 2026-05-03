import { describe, expect, it } from "vitest";
import { addCard, deleteCard, initialColumns, moveCard, renameColumn } from "./board";

describe("board helpers", () => {
  it("starts with five fixed columns and dummy cards", () => {
    expect(initialColumns).toHaveLength(5);
    expect(initialColumns.flatMap((column) => column.cards).length).toBeGreaterThan(0);
  });

  it("adds a card to the selected column", () => {
    const result = addCard(initialColumns, "ready", {
      id: "new-card",
      title: "New task",
      details: "Tiny details"
    });

    expect(result.find((column) => column.id === "ready")?.cards).toContainEqual({
      id: "new-card",
      title: "New task",
      details: "Tiny details"
    });
  });

  it("deletes a card wherever it is found", () => {
    const result = deleteCard(initialColumns, "card-4");

    expect(result.flatMap((column) => column.cards).some((card) => card.id === "card-4")).toBe(
      false
    );
  });

  it("renames a column without accepting a blank title", () => {
    const renamed = renameColumn(initialColumns, "backlog", "Ideas");
    const unchanged = renameColumn(renamed, "backlog", "  ");

    expect(renamed[0].title).toBe("Ideas");
    expect(unchanged[0].title).toBe("Ideas");
  });

  it("moves a card to another column", () => {
    const result = moveCard(initialColumns, "card-1", "done");

    expect(result.find((column) => column.id === "backlog")?.cards).not.toContainEqual(
      expect.objectContaining({ id: "card-1" })
    );
    expect(result.find((column) => column.id === "done")?.cards).toContainEqual(
      expect.objectContaining({ id: "card-1" })
    );
  });
});

