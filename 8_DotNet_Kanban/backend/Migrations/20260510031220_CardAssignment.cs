using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KanbanApi.Migrations
{
    /// <inheritdoc />
    public partial class CardAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AssignedToUserId",
                table: "Cards",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cards_AssignedToUserId",
                table: "Cards",
                column: "AssignedToUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Cards_Users_AssignedToUserId",
                table: "Cards",
                column: "AssignedToUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cards_Users_AssignedToUserId",
                table: "Cards");

            migrationBuilder.DropIndex(
                name: "IX_Cards_AssignedToUserId",
                table: "Cards");

            migrationBuilder.DropColumn(
                name: "AssignedToUserId",
                table: "Cards");
        }
    }
}
