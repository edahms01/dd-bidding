# Field Dictionary

_Generated from `src/state/fieldRegistry.js` by `scripts/generate-field-dictionary.mjs` — do not edit by hand._

## Project

**Project name** — The name of the job being bid. Identifies this bid in history and on the agent summary.

**General contractor** — The general contractor inviting the bid. Used to pull up past history with that GC and to weigh relationship and payment risk.

**Bid due date** — The date the completed bid is due to the GC. Frames how much time is left to refine the numbers.

**Project address** — Street address of the job site. Kept for the record only; it does not affect pricing.

**Building type** — The kind of building, such as office, retail, or healthcare. Helps the agent compare this job to similar past work.

**Drawing set reference** — Which drawing set and revision the takeoff was done from. Reference only, so a newer revision can be spotted later.

**Estimated start date** — When work is expected to begin on site. Feeds the season and schedule-risk read.

**Duration (weeks)** — Expected job length in weeks. Drives waste-disposal cost, which is billed per month on site, and the agent schedule read.

**Number of floors** — How many floors the work covers. A rough measure of job size and how much the work repeats.

**Scope inclusions** — Which parts of the work are included in this bid, such as metal framing, drywall, or plastering. Tells the agent what is and is not priced.

**Exclusions / notes** — A written list of what the bid deliberately leaves out, plus any qualifying notes. Protects against being held to work that was never priced.

## Site Conditions

**Max ceiling height** — The tallest ceiling height on the job, in feet. Sets whether high-work adders and lift rental come into play.

**SF above 12 ft** — Square footage of board that sits between 12 and 20 feet up. Priced with a labor uplift and triggers lift rental.

**SF above 20 ft** — Square footage of board above 20 feet. Priced with a larger labor uplift that stacks on top of the 12-foot one.

**Curved walls** — Whether the job has any curved wall work. Curved framing and board are slower, so this is flagged to the agent.

**Curved wall length** — Linear feet of curved wall, entered when curved walls is set to yes.

**Exterior exposure** — Whether crews will be working exposed to the weather. A job-wide risk signal to the agent, separate from the per-assembly exterior flag.

**Phased work** — Whether the GC is releasing the work in separate phases rather than all at once. Phasing adds remobilization cost and coordination risk.

**Number of phases** — How many separate phases the work is broken into, entered when phased work is set to yes.

**Access difficulty** — Whether getting crews and material to the work area is normal or restricted. Restricted access slows production.

**Parking / unloading** — Whether on-site parking and an unloading zone are available or restricted. Affects how much daily labor is lost to hauling material.

**Waste factor override** — Job-wide extra board material bought to cover offcuts and damage, as a percent. Blank means 10 percent; individual assemblies can override it.

**Estimated delivery trips** — How many material deliveries the job will need. Multiplied by the delivery rate to get delivery cost.

## Assemblies

**Assembly type ID** — Short code for this wall or ceiling system, like W1 or C2. Each wall and ceiling row references it to pull in the assembly makeup.

**Category** — Whether this assembly is a wall or a ceiling. Sets which takeoff table references it and drives the auto-generated type ID.

**Stud size** — Width of the metal studs in this assembly. Picks the matching stud material price.

**Board layers** — How many layers of gypsum board per face. Multiplies the hanging labor and the board material for this assembly.

**Board type** — The kind of gypsum board: standard, Type-X, moisture, or impact. Picks the matching board material price.

**Fire rating** — The fire-resistance rating of this assembly. Captured for the record and the agent; not currently used in a cost formula.

**Acoustic** — Whether this assembly carries acoustic insulation. When set to yes, adds insulation material cost (net square footage times the insulation rate); no labor is added.

**Finish level** — The finish level, 1 through 5, for this assembly. Picks the matching taping and finishing rate.

**Exterior wall** — Wall assemblies only. When set to yes, this assembly is priced with the external wall rate instead of the drywall hanging rate.

**Notes** — Free-text notes about this assembly. Passed to the agent; not costed.

**Waste % override** — A waste percent for this assembly alone, replacing the job-wide waste factor when set.

## Walls

**Location** — Where this run of wall is: floor, area, or zone. Labels the row; not costed.

**Type ID** — The assembly type ID this wall run is built from. Pulls in that assembly’s studs, board, layers, and finish.

**Wall height (ft)** — Floor-to-ceiling height of the run, in feet. Used with linear feet to work out board area when entering by dimensions.

**LF framing** — Linear feet of wall to frame. Drives framing labor and, with height, the board area.

**Gross SF board** — Total board square footage for this run before openings are taken out.

**Openings (SF)** — Square footage of doors and windows to subtract from gross, giving the net board area that gets priced.

**Wall entry mode** — Whether wall quantities are entered by dimensions (height and length) or straight as area. Only changes which columns show, not the price.

## Ceilings

**Location** — Where this ceiling area is: floor, room, or zone. Labels the row; not costed.

**Type ID** — The assembly type ID this ceiling area is built from. Pulls in that assembly’s makeup.

**Ceiling height (ft)** — Height of this ceiling above the floor, in feet. Used for high-work adders when entering by dimensions.

**Gross SF board** — Total ceiling board square footage before openings are taken out.

**Soffit LF** — Linear feet of soffit or bulkhead around this ceiling. Captured for the agent; not currently costed.

**Openings (SF)** — Square footage of light fixtures and diffusers to subtract from gross, giving the net ceiling area that gets priced.

**Ceiling entry mode** — Whether ceiling quantities are entered by dimensions or straight as area. Only changes which columns show, not the price.

## Rates

**Metal framing rate** — Labor price to install metal stud framing, per linear foot, at standard height. Height adders are applied on top automatically.

**Drywall hanging rate** — Labor price to hang gypsum board, per square foot, multiplied by the number of board layers in each assembly.

**External wall rate** — Labor price per square foot that replaces the drywall hanging rate for any wall assembly flagged as exterior.

**Labor burden %** — Payroll taxes, workers comp, and benefits added on top of raw wages, as a percent of labor. Typically 28 to 40 percent.

**Supervision %** — Foreman cost as a percent of total labor. Typically 6 to 12 percent.

**Taping + finishing rates** — Labor price per square foot to tape and finish board, with one rate per finish level, 1 through 5.

**Above 12 ft adder %** — Extra labor percent applied to board area between 12 and 20 feet up, where a lift is needed.

**Above 20 ft adder %** — Extra labor percent applied to board area above 20 feet. Stacks on top of the 12-foot adder.

**Stud + track prices** — Material price per linear foot for studs and track, with one price per stud size.

**Drywall board prices** — Material price per square foot for gypsum board, with one price per board type: standard, Type-X, moisture, or impact.

**Tape + compound rate** — Material allowance per finished square foot for joint tape and compound.

**Insulation rate** — Material price per square foot for insulation, applied to assemblies with the acoustic flag set.

**Fasteners + adhesive rate** — Flat material allowance per square foot for screws, adhesive, and related fasteners.

**Delivery rate** — Cost per material delivery trip. Multiplied by the estimated number of trips.

**Waste disposal rate** — Dumpster and haul-off cost per month on site. Multiplied by the job duration in whole months.

**Lift rental rate** — Rental cost per week for a lift. Only charged when there is board area above 12 feet.

**Stud price escalation %** — Expected price increase over the life of the job for studs and track, per stud size, added on top of the base material price.

**Board price escalation %** — Expected price increase over the life of the job for gypsum board, per board type.

**Tape + compound escalation %** — Expected price increase over the life of the job for tape and compound.

**Insulation escalation %** — Expected price increase over the life of the job for insulation.

**Fasteners escalation %** — Expected price increase over the life of the job for fasteners and adhesive.

**Company overhead %** — Office, insurance, and fleet cost added as a percent of direct cost. The first of the three markups that turn cost into price.

**Risk / contingency %** — The estimator’s own buffer for this job, as a percent. Starts blank and is a purely manual judgement call.

**Profit margin %** — Target profit taken on top of direct cost and overhead. The last markup applied before the bid price.

## Cost Summary

_No fields are entered on this tab._

## Market Read

**Estimator confidence** — How sure the estimator is about the takeoff overall: high, medium, or low. Signals to the pricing agent how much risk buffer the bid should carry.

**Estimator notes** — Free-text gut feel: GC history, site concerns, anything not captured in the structured fields. Passed to the agent as context.

**Crew availability** — How booked Dirigo's crews are right now. Tight availability pushes the target margin up.

**Pipeline pressure** — How badly Dirigo needs this job given the rest of the pipeline. A direct signal on how aggressive to price.

**Material price trend** — Whether material prices are rising, stable, or falling. A rising trend may warrant rate escalation or more contingency.

**GC relationship** — How strong the working relationship with this GC is. Strong relationships lower payment risk and can justify a tighter margin.

**GC price sensitivity** — Whether this GC always takes the lowest number or will pay for quality. Sets how much margin the market will bear.

**Competition level** — How many other firms are expected to bid. More competition means a tighter spread between winning and losing.

**Known competitors** — Names of the other firms expected to bid. Logged for win-rate pattern analysis; not used in the current calculation.

**Dirigo's edge** — The estimator’s read on how well Dirigo fits this job versus competitors. A strong edge supports premium pricing.

## Bid Strategy

_No fields are entered on this tab._
