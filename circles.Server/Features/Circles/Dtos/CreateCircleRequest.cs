using System.ComponentModel.DataAnnotations;

namespace circles.Server.Features.Circles.Dtos;

public class CreateCircleRequest
{
    [Required(ErrorMessage = "Circle name is required and cannot be empty.")]
    [StringLength(200, ErrorMessage = "Circle name cannot exceed 200 characters.")]
    public string Name { get; set; } = string.Empty;
}
