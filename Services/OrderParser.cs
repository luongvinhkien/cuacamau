using System.Globalization;
using System.Text.RegularExpressions;
using BanhangcodeX.Data;
using BanhangcodeX.Models;
using Microsoft.EntityFrameworkCore;

namespace BanhangcodeX.Services;

public record ParsedOrder(
    string CustomerName,
    string ProductName,
    string? Size,
    string? Color,
    int Quantity,
    decimal WeightKg,
    decimal Price,
    int? CustomerId,
    string? Phone,
    string? Address,
    string MatchType,
    double Confidence,
    List<Customer> Suggestions);

public class OrderParser(AppDbContext db)
{
    public async Task<ParsedOrder> Parse(string text)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Length > 500)
            throw new ArgumentException("Nhập câu chốt đơn hợp lệ (tối đa 500 ký tự).");

        var products = await db.Products.AsNoTracking().ToListAsync();
        var sizeMatch = Regex.Match(text, @"(?i)\b(?:size|sz)\s*([a-z0-9]+)\b");
        var spokenSize = sizeMatch.Success ? sizeMatch.Groups[1].Value : null;
        var spokenColor = products.Select(p => p.Color).Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct().FirstOrDefault(x => text.Contains(x!, StringComparison.OrdinalIgnoreCase));

        var namedProducts = products.Where(p => text.Contains(p.Name, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.Name.Length).ToList();
        // If the shop has only one product name, allow it to be omitted from the spoken phrase.
        if (namedProducts.Count == 0 && products.Select(p => p.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count() == 1)
            namedProducts = products.OrderByDescending(p => p.Name.Length).ToList();

        var product = namedProducts.FirstOrDefault(p =>
                (spokenSize == null || string.Equals(p.Size, spokenSize, StringComparison.OrdinalIgnoreCase)) &&
                (spokenColor == null || string.Equals(p.Color, spokenColor, StringComparison.OrdinalIgnoreCase)))
            ?? namedProducts.FirstOrDefault();
        var productName = product?.Name ?? "";
        var size = spokenSize ?? product?.Size;
        var color = spokenColor ?? product?.Color;

        var quantityMatch = Regex.Match(text, @"(?i)(\d+)\s*(?:x|cái|sp)\b");
        var spokenQuantity = Regex.Match(text, @"(?i)\b(?:chốt|chot|lấy|lay|mua)\s+(\d+)\s+(?=\p{L})");
        var quantity = quantityMatch.Success ? int.Parse(quantityMatch.Groups[1].Value)
            : spokenQuantity.Success ? int.Parse(spokenQuantity.Groups[1].Value) : 1;

        var weightMatch = Regex.Match(text,
            @"(?i)(\d+(?:[.,]\d+)?)\s*(?:kg|kilogram(?:s)?|kí\s*lô(?:gam)?|kilô(?:gam)?|cân)\b");
        var weightKg = weightMatch.Success
            ? decimal.Parse(weightMatch.Groups[1].Value.Replace(',', '.'), CultureInfo.InvariantCulture)
            : 0m;

        var priceMatch = Regex.Match(text, @"(?i)(?:giá\s*)?(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|triệu)?\s*$");
        var price = product?.Price ?? 0m;
        if (priceMatch.Success)
        {
            var number = decimal.Parse(priceMatch.Groups[1].Value.Replace(',', '.'), CultureInfo.InvariantCulture);
            var unit = priceMatch.Groups[2].Value.ToLowerInvariant();
            price = unit is "k" or "nghìn" or "ngàn" ? number * 1000
                : unit == "triệu" ? number * 1_000_000
                : number < 10_000 ? number * 1000 : number;
        }

        // Use whitespace delimiters instead of \b: .NET word boundaries can behave unexpectedly with Vietnamese diacritics.
        var actionMatch = Regex.Match(text, @"(?i)(?:^|\s)(?:chốt|chot|lấy|lay|mua|đặt|dat)(?=\s|$)");
        var customerName = (actionMatch.Success ? text[..actionMatch.Index] : text).Trim(' ', ',', '.', ':');
        if (customerName.Length < 2) customerName = "Khách mới";

        var customers = await db.Customers.AsNoTracking().ToListAsync();
        var exact = customers.FirstOrDefault(c => Normalize(c.Name) == Normalize(customerName));
        var candidates = customers.Select(c => (Customer: c, Score: Similarity(Normalize(c.Name), Normalize(customerName))))
            .OrderByDescending(x => x.Score).Take(3).ToList();
        var match = exact;
        var matchType = exact == null ? "new" : "exact";
        var confidence = exact == null ? 0d : 1d;
        if (exact == null && candidates.Count > 0 && candidates[0].Score >= .62)
        {
            match = candidates[0].Customer;
            matchType = "suggestion";
            confidence = candidates[0].Score;
        }

        return new(customerName, productName, size, color, quantity, weightKg, price,
            match?.Id, match?.Phone, match?.Address, matchType, confidence,
            candidates.Where(x => x.Score >= .45).Select(x => x.Customer).ToList());
    }

    private static string Normalize(string value) => Regex.Replace(
        value.ToLowerInvariant().Normalize(System.Text.NormalizationForm.FormD), @"[\u0300-\u036f]", "").Trim();

    private static double Similarity(string a, string b) =>
        1.0 / Math.Max(a.Length, b.Length) * Math.Max(0, Math.Max(a.Length, b.Length) - Distance(a, b));

    private static int Distance(string a, string b)
    {
        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
        for (var j = 1; j <= b.Length; j++)
            d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                d[i - 1, j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
        return d[a.Length, b.Length];
    }
}
