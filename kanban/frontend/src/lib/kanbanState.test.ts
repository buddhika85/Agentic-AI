import { describe, expect, it } from "vitest";

import { addCard, createInitialBoard, deleteCard, moveCard, renameColumn } from "./kanbanState";

describe("kanban state", () => {
  it("creates a board with five columns", () => {
    const board = createInitialBoard();
    expect(board.columns).toHaveLength(5);
  });

  it("renames a column when a non-empty title is provided", () => {
    const board = createInitialBoard();
    const nextBoard = renameColumn(board, "column-1", "Ideas");
    expect(nextBoard.columns[0]?.title).toBe("Ideas");
  });

  it("does not rename a column when title is empty", () => {
    const board = createInitialBoard();
    const nextBoard = renameColumn(board, "column-1", "   ");
    expect(nextBoard).toBe(board);
  });

  it("adds a card to the target column", () => {
    const board = createInitialBoard();
    const nextBoard = addCard(board, "column-2", "Accessibility", "Add keyboard support");
    expect(nextBoard.columns[1]?.cardIds.at(-1)).toBe("card-7");
    expect(nextBoard.cardsById["card-7"]?.title).toBe("Accessibility");
    expect(nextBoard.nextCardNumber).toBe(8);
  });

  it("rejects add card when required fields are empty", () => {
    const board = createInitialBoard();
    const nextBoard = addCard(board, "column-2", "   ", "details");
    expect(nextBoard).toBe(board);
  });

  it("deletes a card from board and column", () => {
    const board = createInitialBoard();
    const nextBoard = deleteCard(board, "column-3", "card-4");
    expect(nextBoard.cardsById["card-4"]).toBeUndefined();
    expect(nextBoard.columns[2]?.cardIds).toEqual([]);
  });

  it("moves cards between columns", () => {
    const board = createInitialBoard();
    const nextBoard = moveCard(board, "card-2", "column-1", "column-3", 0);
    expect(nextBoard.columns[0]?.cardIds).toEqual(["card-1"]);
    expect(nextBoard.columns[2]?.cardIds[0]).toBe("card-2");
  });

  it("reorders cards when moving inside same column", () => {
    const board = createInitialBoard();
    const nextBoard = moveCard(board, "card-1", "column-1", "column-1", 1);
    expect(nextBoard.columns[0]?.cardIds).toEqual(["card-2", "card-1"]);
  });
});
