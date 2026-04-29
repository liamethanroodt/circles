// Components
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const AVATAR_SIZE = 32; // px — matches shadcn default size-8
const HALF = AVATAR_SIZE / 2;

// baseAngle: ring 1 starts at 0°, ring 2 is offset halfway between ring 1's gaps (45°),
// ring 3 is halfway between ring 1 and ring 2's starts (22.5°) — so no three rings share an angle.
const RINGS = [
	{ radius: 100, names: ["Alice", "Bob", "Charlie", "Diana"], baseAngle: 0, duration: 40, clockwise: true },
	{ radius: 160, names: ["Edward", "Fiona", "George", "Hannah"], baseAngle: 45, duration: 55, clockwise: false },
	{ radius: 220, names: ["Ivan", "Julia", "Kevin", "Laura"], baseAngle: 22.5, duration: 35, clockwise: true },
] as const;

const OUTER_RADIUS = RINGS[RINGS.length - 1].radius;
const CENTER = OUTER_RADIUS + HALF;
const CONTAINER_SIZE = CENTER * 2;

interface Props {
	children: React.ReactNode;
}

export function ConcentricRings({ children }: Props) {
	return (
		<div style={{ position: "relative", width: CONTAINER_SIZE, height: CONTAINER_SIZE, flexShrink: 0 }}>
			{/* CSS keyframes injected once */}
			<style>{`
				@keyframes ring-spin-cw  { to { transform: rotate(360deg);  } }
				@keyframes ring-spin-ccw { to { transform: rotate(-360deg); } }
			`}</style>

			{/* Ring border lines */}
			{RINGS.map((ring) => (
				<div
					key={ring.radius}
					style={{
						position: "absolute",
						width: ring.radius * 2,
						height: ring.radius * 2,
						left: CENTER - ring.radius,
						top: CENTER - ring.radius,
						borderRadius: "50%",
						border: "1px solid rgba(0,0,0,0.25)",
						pointerEvents: "none",
					}}
				/>
			))}
			{/* Center element */}
			<div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>{children}</div>
			{/* Orbiting avatars — each ring uses a zero-size rotating wrapper at center */}
			{RINGS.map((ring) => {
				const spinAnim = ring.clockwise ? "ring-spin-cw" : "ring-spin-ccw";
				const counterAnim = ring.clockwise ? "ring-spin-ccw" : "ring-spin-cw";

				return (
					<div
						key={ring.radius}
						style={{
							position: "absolute",
							left: CENTER,
							top: CENTER,
							width: 0,
							height: 0,
							animation: `${spinAnim} ${ring.duration}s linear infinite`,
						}}
					>
						{([0, 1, 2, 3] as const).map((ai) => {
							const angle = ring.baseAngle + ai * 90;
							const rad = (angle * Math.PI) / 180;
							const x = ring.radius * Math.cos(rad) - HALF;
							const y = ring.radius * Math.sin(rad) - HALF;
							const name = ring.names[ai];
							const initials = name.slice(0, 2).toUpperCase();

							return (
								<Tooltip key={ai}>
									<TooltipTrigger asChild>
										<div
											style={{
												position: "absolute",
												left: x,
												top: y,
												animation: `${counterAnim} ${ring.duration}s linear infinite`,
												cursor: "default",
											}}
										>
											<Avatar>
												<AvatarFallback>{initials}</AvatarFallback>
											</Avatar>
										</div>
									</TooltipTrigger>
									<TooltipContent>{name}</TooltipContent>
								</Tooltip>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}
