using BanhangcodeX.Data;
using BanhangcodeX.Models;
using BanhangcodeX.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BanhangcodeX.Controllers;

[ApiController, Route("api/orders"), Authorize]
public class OrdersController(AppDbContext db, OrderParser parser) : ControllerBase
{
    public record ParseInput(string Text);
    public record Line(int? ProductId, string ProductName, string? Color, string? Size,
        int Quantity, decimal WeightKg, decimal Price);
    public record Create(int? CustomerId, string? CustomerName, string? Phone, string? Address, List<Line> Items);
    public record Update(int CustomerId, string CustomerName, string? Phone, string? Address, List<Line> Items);
    public record StatusInput(string Status);

    [HttpPost("parse")]
    public async Task<IActionResult> Parse(ParseInput input)
    {
        try { return Ok(await parser.Parse(input.Text)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder(Create input)
    {
        if (input.Items.Count is < 1 or > 50 || input.Items.Any(i => i.Quantity < 1 || i.WeightKg < 0 || i.Price < 0))
            return BadRequest(new { message = "Đơn cần có ít nhất một dòng hợp lệ; số lượng, kg và giá không được âm." });

        var customer = input.CustomerId is int customerId ? await db.Customers.FindAsync(customerId) : null;
        if (input.CustomerId.HasValue && customer == null)
            return NotFound(new { message = "Không tìm thấy khách hàng đã chọn." });

        if (customer == null)
        {
            if (string.IsNullOrWhiteSpace(input.CustomerName))
                return BadRequest(new { message = "Cần có tên khách hàng." });
            customer = new Customer
            {
                Code = $"KH{Guid.NewGuid():N}"[..14],
                Name = input.CustomerName.Trim(),
                Phone = input.Phone,
                Address = input.Address
            };
            db.Customers.Add(customer);
            await db.SaveChangesAsync();
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(input.Phone)) customer.Phone = input.Phone;
            if (!string.IsNullOrWhiteSpace(input.Address)) customer.Address = input.Address;
        }

        var now = DateTime.UtcNow;
        var order = new Order
        {
            OrderCode = $"DH{now:yyMMddHHmmss}{Random.Shared.Next(1000, 9999)}",
            CustomerId = customer.Id,
            OrderDate = now,
            Status = "CONFIRMED"
        };
        foreach (var line in input.Items)
            order.Details.Add(new OrderDetail
            {
                ProductId = line.ProductId,
                ProductName = line.ProductName.Trim(),
                Color = line.Color,
                Size = line.Size,
                Quantity = line.Quantity,
                WeightKg = line.WeightKg,
                Price = line.Price,
                Amount = line.Quantity * line.Price
            });
        order.TotalAmount = order.Details.Sum(d => d.Amount);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        return Ok(await db.Orders.AsNoTracking().Include(o => o.Customer).Include(o => o.Details)
            .SingleAsync(o => o.Id == order.Id));
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] string? status, [FromQuery] int? customerId, [FromQuery] string? product)
    {
        var query = db.Orders.AsNoTracking().Include(o => o.Customer).Include(o => o.Details).AsQueryable();
        if (from != null) query = query.Where(o => o.OrderDate >= from);
        if (to != null) query = query.Where(o => o.OrderDate < to.Value.AddDays(1));
        if (!string.IsNullOrEmpty(status)) query = query.Where(o => o.Status == status);
        if (customerId != null) query = query.Where(o => o.CustomerId == customerId);
        if (!string.IsNullOrEmpty(product)) query = query.Where(o => o.Details.Any(d => d.ProductName.Contains(product)));
        return Ok(await query.OrderByDescending(o => o.OrderDate).Take(500).ToListAsync());
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Customer).Include(o => o.Details)
            .FirstOrDefaultAsync(o => o.Id == id);
        return order == null ? NotFound() : Ok(order);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateOrder(int id, Update input)
    {
        if (string.IsNullOrWhiteSpace(input.CustomerName) || input.Items.Count is < 1 or > 50 ||
            input.Items.Any(i => string.IsNullOrWhiteSpace(i.ProductName) || i.Quantity < 1 || i.WeightKg < 0 || i.Price < 0))
            return BadRequest(new { message = "Thông tin khách và ít nhất một dòng sản phẩm phải hợp lệ." });

        var order = await db.Orders.Include(o => o.Details).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();
        var customer = await db.Customers.FindAsync(input.CustomerId);
        if (customer == null) return NotFound(new { message = "Không tìm thấy khách hàng của đơn." });

        var productIds = input.Items.Where(i => i.ProductId.HasValue).Select(i => i.ProductId!.Value).Distinct().ToList();
        if (productIds.Count > 0 && await db.Products.CountAsync(p => productIds.Contains(p.Id)) != productIds.Count)
            return BadRequest(new { message = "Một sản phẩm trong đơn không còn tồn tại." });

        customer.Name = input.CustomerName.Trim();
        customer.Phone = input.Phone;
        customer.Address = input.Address;
        customer.UpdatedAt = DateTime.UtcNow;
        db.OrderDetails.RemoveRange(order.Details);
        order.Details.Clear();
        foreach (var line in input.Items)
            order.Details.Add(new OrderDetail
            {
                ProductId = line.ProductId,
                ProductName = line.ProductName.Trim(),
                Color = line.Color,
                Size = line.Size,
                Quantity = line.Quantity,
                WeightKg = line.WeightKg,
                Price = line.Price,
                Amount = line.Quantity * line.Price
            });
        order.TotalAmount = order.Details.Sum(d => d.Amount);
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật đơn hàng." });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteOrder(int id)
    {
        var order = await db.Orders.FindAsync(id);
        if (order == null) return NotFound();
        db.Orders.Remove(order);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> Status(int id, StatusInput input)
    {
        string[] states = ["NEW", "CONFIRMED", "PICKING", "PACKED", "SHIPPED", "COMPLETED", "CANCELLED"];
        var order = await db.Orders.FindAsync(id);
        if (order == null) return NotFound();
        if (!states.Contains(input.Status)) return BadRequest(new { message = "Trạng thái không hợp lệ." });
        order.Status = input.Status;
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(order);
    }

    [HttpGet("picking-summary")]
    public async Task<IActionResult> Picking([FromQuery] DateTime? date)
    {
        var day = (date ?? DateTime.UtcNow.AddHours(7).Date).Date;
        var orders = await db.Orders.AsNoTracking().Include(o => o.Details)
            .Where(o => o.OrderDate >= day && o.OrderDate < day.AddDays(1) && o.Status != "CANCELLED")
            .ToListAsync();
        return Ok(orders.SelectMany(o => o.Details)
            .GroupBy(d => new { d.ProductName, d.Color, d.Size })
            .Select(g => new { g.Key.ProductName, g.Key.Color, g.Key.Size, Quantity = g.Sum(d => d.Quantity), WeightKg = g.Sum(d => d.WeightKg) })
            .OrderBy(x => x.ProductName).ThenBy(x => x.Size));
    }
}
