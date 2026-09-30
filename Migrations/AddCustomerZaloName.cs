using BanhangcodeX.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace BanhangcodeX.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("202609300002_AddCustomerZaloName")]
public sealed class AddCustomerZaloName : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("ALTER TABLE `Customers` ADD COLUMN `ZaloName` varchar(120) NULL AFTER `Phone`;");

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("ALTER TABLE `Customers` DROP COLUMN `ZaloName`;");
}
