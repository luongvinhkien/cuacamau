using BanhangcodeX.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace BanhangcodeX.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("202609300001_AddOrderDetailWeightKg")]
public sealed class AddOrderDetailWeightKg : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("ALTER TABLE `OrderDetails` ADD COLUMN `WeightKg` decimal(10,3) NOT NULL DEFAULT 0;");

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("ALTER TABLE `OrderDetails` DROP COLUMN `WeightKg`;");
}
