import { fireEvent, render, screen, within } from "@testing-library/react";
import Board from "./Board";
import { initialCards, initialColumns } from "@/lib/kanban";

describe("Board", () => {
  test("renders five columns", () => {
    render(
      <Board initialColumns={initialColumns} initialCards={initialCards} />,
    );
    const columns = screen.getAllByTestId("column-panel");
    expect(columns).toHaveLength(5);
  });

  test("adds and deletes a card", () => {
    render(
      <Board initialColumns={initialColumns} initialCards={initialCards} />,
    );
    const firstColumn = screen.getAllByTestId("column-panel")[0];
    const titleInput = within(firstColumn).getByPlaceholderText("Card title");
    const detailsInput =
      within(firstColumn).getByPlaceholderText("Card details");
    const addButton = within(firstColumn).getByRole("button", {
      name: /add card/i,
    });

    fireEvent.change(titleInput, { target: { value: "Test card" } });
    fireEvent.change(detailsInput, { target: { value: "Card details" } });
    fireEvent.click(addButton);

    expect(screen.getByText("Test card")).toBeInTheDocument();

    const card = screen
      .getByText("Test card")
      .closest('[data-testid="card-item"]');
    expect(card).toBeInTheDocument();

    const deleteButton = within(card as HTMLElement).getByRole("button", {
      name: /delete card/i,
    });
    fireEvent.click(deleteButton);

    expect(screen.queryByText("Test card")).not.toBeInTheDocument();
  });
});
