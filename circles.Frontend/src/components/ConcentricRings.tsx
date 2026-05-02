// React
import React from "react";

// Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Icons
import { Plus } from "lucide-react";

const AVATAR_SIZE = 32; // px — matches shadcn default size-8
const HALF = AVATAR_SIZE / 2;
const CREATE_RING_RADIUS = 140;
const FIRST_CIRCLE_RADIUS = 200;
const RADIUS_STEP = 60;
const MAX_AVATARS_PER_RING = 6;

export interface PostAvatar {
	id: string;
	imageUrl?: string;
	label: string;
}

export interface CircleRingData {
	id: string;
	name: string;
	posts: PostAvatar[];
}

interface RingSpec {
	id: string;
	name: string;
	radius: number;
	clockwise: boolean;
	duration: number;
	baseAngle: number;
	isCreate: boolean;
	posts: PostAvatar[];
}

interface Props {
	circles: CircleRingData[];
	onCreateCircle: () => void;
	onCircleClick: (circleId: string) => void;
	children: React.ReactNode;
}

export function ConcentricRings({ circles, onCreateCircle, onCircleClick, children }: Props) {
	const createRing: RingSpec = {
		id: "__create__",
		name: "New Circle",
		radius: CREATE_RING_RADIUS,
		clockwise: true,
		duration: 25,
		baseAngle: 270, // start at top
		isCreate: true,
		posts: [],
	};

	const userRings: RingSpec[] = circles.map((c, i) => ({
		id: c.id,
		name: c.name,
		radius: FIRST_CIRCLE_RADIUS + i * RADIUS_STEP,
		clockwise: i % 2 === 0,
		duration: 40 + i * 8,
		baseAngle: (i + 1) * 22.5,
		isCreate: false,
		posts: c.posts,
	}));

	const allRings: RingSpec[] = [createRing, ...userRings];
	const outerRadius = allRings[allRings.length - 1].radius;
	const CENTER = outerRadius + HALF;
	const CONTAINER_SIZE = CENTER * 2;

	return (
		<div style={{ position: "relative", width: CONTAINER_SIZE, height: CONTAINER_SIZE, flexShrink: 0 }}>
			{/* CSS keyframes */}
			<style>{`
				@keyframes ring-spin-cw  { to { transform: rotate(360deg);  } }
				@keyframes ring-spin-ccw { to { transform: rotate(-360deg); } }
				.ring-click-target:hover + .ring-visual {
					stroke-opacity: 0.6;
					stroke-width: 2;
				}
				.ring-visual {
					transition: stroke-opacity 0.2s, stroke-width 0.2s;
				}
			`}</style>

			{/* SVG layer for ring borders — stroke pointer-events lets us click only the ring line */}
			<svg
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: CONTAINER_SIZE,
					height: CONTAINER_SIZE,
					overflow: "visible",
					pointerEvents: "none",
				}}
			>
				{allRings.map((ring) => (
					<g key={ring.id}>
						{/* Wide transparent hit area — only for user circles */}
						{!ring.isCreate && (
							<circle
								cx={CENTER}
								cy={CENTER}
								r={ring.radius}
								fill="none"
								stroke="transparent"
								strokeWidth="16"
								style={{ cursor: "pointer", pointerEvents: "stroke" }}
								onClick={() => onCircleClick(ring.id)}
								className="ring-click-target"
							/>
						)}
						{/* Visible thin ring */}
						<circle
							cx={CENTER}
							cy={CENTER}
							r={ring.radius}
							fill="none"
							stroke="rgba(0,0,0,0.2)"
							strokeWidth="1"
							style={{ pointerEvents: "none" }}
							className="ring-visual"
						/>
					</g>
				))}
			</svg>

			{/* Center element */}
			<div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>{children}</div>

			{/* Orbiting avatars */}
			{allRings.map((ring) => {
				const spinAnim = ring.clockwise ? "ring-spin-cw" : "ring-spin-ccw";
				const counterAnim = ring.clockwise ? "ring-spin-ccw" : "ring-spin-cw";

				if (ring.isCreate) {
					const rad = (ring.baseAngle * Math.PI) / 180;
					const x = ring.radius * Math.cos(rad) - HALF;
					const y = ring.radius * Math.sin(rad) - HALF;
					return (
						<div
							key={ring.id}
							style={{
								position: "absolute",
								left: CENTER,
								top: CENTER,
								width: 0,
								height: 0,
								animation: `${spinAnim} ${ring.duration}s linear infinite`,
							}}
						>
							<Tooltip>
								<TooltipTrigger asChild>
									<div
										style={{
											position: "absolute",
											left: x,
											top: y,
											animation: `${counterAnim} ${ring.duration}s linear infinite`,
											cursor: "pointer",
										}}
										onClick={onCreateCircle}
									>
										<Avatar className="border-2 border-dashed border-gray-400 bg-white hover:bg-gray-50 transition-colors">
											<AvatarFallback className="bg-transparent">
												<Plus className="size-4" />
											</AvatarFallback>
										</Avatar>
									</div>
								</TooltipTrigger>
								<TooltipContent>Create new circle</TooltipContent>
							</Tooltip>
						</div>
					);
				}

				const visiblePosts = ring.posts.slice(0, MAX_AVATARS_PER_RING);
				return (
					<div
						key={ring.id}
						style={{
							position: "absolute",
							left: CENTER,
							top: CENTER,
							width: 0,
							height: 0,
							animation: `${spinAnim} ${ring.duration}s linear infinite`,
						}}
					>
						{visiblePosts.map((post, ai) => {
							const angle = ring.baseAngle + (ai * 360) / Math.max(visiblePosts.length, 1);
							const rad = (angle * Math.PI) / 180;
							const x = ring.radius * Math.cos(rad) - HALF;
							const y = ring.radius * Math.sin(rad) - HALF;

							return (
								<Tooltip key={post.id}>
									<TooltipTrigger asChild>
										<div
											style={{
												position: "absolute",
												left: x,
												top: y,
												animation: `${counterAnim} ${ring.duration}s linear infinite`,
												cursor: "pointer",
											}}
											onClick={() => onCircleClick(ring.id)}
										>
											<Avatar>
												{post.imageUrl && <AvatarImage src={post.imageUrl} alt={post.label} />}
												<AvatarFallback>{post.label.slice(0, 2).toUpperCase()}</AvatarFallback>
											</Avatar>
										</div>
									</TooltipTrigger>
									<TooltipContent>{ring.name}</TooltipContent>
								</Tooltip>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}
