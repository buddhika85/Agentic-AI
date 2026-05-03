import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { AuthProvider } from "@/lib/auth";
import { BoardProvider } from "@/lib/boardApi";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <AuthProvider>
      <BoardProvider authToken="fake-token" isAuthenticated={true}>
        {component}
      </BoardProvider>
    </AuthProvider>,
  );
};

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    renderWithProviders(<KanbanBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("shows AI Assistant heading", () => {
    renderWithProviders(<KanbanBoard />);
    expect(screen.getAllByText("AI Assistant").length).toBeGreaterThanOrEqual(1);
  });

  it("renames a column", async () => {
    renderWithProviders(<KanbanBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    renderWithProviders(<KanbanBoard />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });
});
