using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace circles.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddFriendshipsAndInvitations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CircleInvitations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CircleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InviterId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    InviteeId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CircleInvitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CircleInvitations_Circles_CircleId",
                        column: x => x.CircleId,
                        principalTable: "Circles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Friendships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequesterId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AddresseeId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Friendships", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CircleInvitations_CircleId",
                table: "CircleInvitations",
                column: "CircleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CircleInvitations");

            migrationBuilder.DropTable(
                name: "Friendships");
        }
    }
}
